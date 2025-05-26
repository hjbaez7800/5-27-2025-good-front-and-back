import databutton as db
import re # Import regular expression module
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from google.cloud import vision
from google.api_core.client_options import ClientOptions # Import ClientOptions
from typing import Optional
from typing import Dict # Import Optional
from google.api_core.exceptions import GoogleAPIError, ServiceUnavailable # Import necessary exceptions

# Initialize Google Vision Client
# NOTE: Make sure GOOGLE_VISION_API_KEY secret is set in Databutton
gcp_api_key = db.secrets.get("GOOGLE_VISION_API_KEY")
if not gcp_api_key:
    print("WARNING: GOOGLE_VISION_API_KEY secret not found. OCR endpoint will not work.")
    vision_client = None
else:
    try:
        # Correctly initialize the client using the API key via ClientOptions
        client_options = ClientOptions(api_key=gcp_api_key)
        vision_client = vision.ImageAnnotatorClient(client_options=client_options)
        print("Google Vision client initialized successfully using API key.")
    except Exception as e:
        print(f"ERROR: Failed to initialize Google Vision client with API key: {e}")
        vision_client = None

router = APIRouter()

class OcrResponse(BaseModel):
    """Response model containing the structured nutrient data extracted from the image."""
    protein: float
    total_fat: float
    total_carbohydrate: float
    dietary_fiber: float
    total_sugars: float
    servings: float

# --- Helper function for parsing --- 
def find_nearest_number(text_segment: str, prioritize_grams: bool = True) -> Optional[float]:
    """Finds the first number (int or float) in a text segment, optionally prioritizing grams."""
    # Preprocessing: Replace common OCR errors for zero
    processed_segment = text_segment.replace('o', '0').replace('O', '0')
    # print(f"      [find_nearest_number] Original Segment: '{text_segment}'") # Debug print removed
    # print(f"      [find_nearest_number] Processed Segment: '{processed_segment}'") # Debug print removed

    # Check for '<1' patterns first (using processed segment)
    if re.search(r"[<|less than]\s*1\s*g", processed_segment, re.IGNORECASE):
        # print("      [find_nearest_number] Match: Found '<1g' pattern -> 0.5") # Debug print removed
        return 0.5 # Treat '<1g' as 0.5g as a common convention

    # Priority 1: Look for numbers followed by 'g' or 'gram(s)' (case insensitive, using processed segment)
    if prioritize_grams:
        gram_matches = re.findall(r"(\d+(?:\.\d+)?|\.\d+)\s*g(?:ram|rams)?", processed_segment, re.IGNORECASE)
        # print(f"      [find_nearest_number] Gram Regex Matches (prioritized: {prioritize_grams}): {gram_matches}") # Debug print removed
        if gram_matches:
            try:
                value = float(gram_matches[0])
                # print(f"      [find_nearest_number] Match: Prioritizing Gram Value -> {value}") # Debug print removed
                return value
            except ValueError:
                # print(f"      [find_nearest_number] Error: Could not convert gram value '{gram_matches[0]}' to float.") # Debug print removed
                pass # Keep pass to handle error gracefully
    # else: # This else block only contained a print, can be removed if its print is removed
        # print("      [find_nearest_number] Gram Regex Matches (prioritized: False): Skipped") # Debug print removed

    # Priority 2: Look for any digits, potentially with a decimal point (fallback, using processed segment)
    numbers_not_g = re.findall(r"(\d+(?:\.\d+)?|\.\d+)(?!\s*(?:g|%))", processed_segment)
    if not prioritize_grams and numbers_not_g:
        # print(f"      [find_nearest_number] Fallback Num Regex (prioritize_grams=False, excluding g, %): {numbers_not_g}") # Debug print removed
        selected_value_str = None
        if len(numbers_not_g) > 1:
            for num_str_candidate in numbers_not_g:
                if num_str_candidate not in ["0", "0.0"]:
                    selected_value_str = num_str_candidate
                    # print(f"      [find_nearest_number] Selected non-zero candidate for servings: {selected_value_str}") # Debug print removed
                    break
            if not selected_value_str:
                selected_value_str = numbers_not_g[0]
                # print(f"      [find_nearest_number] All candidates were zero or only one found. Selected: {selected_value_str}") # Debug print removed
        elif numbers_not_g:
            selected_value_str = numbers_not_g[0]
            # print(f"      [find_nearest_number] Single candidate for servings: {selected_value_str}") # Debug print removed
        
        if selected_value_str:
            try:
                value = float(selected_value_str)
                # print(f"      [find_nearest_number] Match: Using Fallback (not g, not %) Value -> {value}") # Debug print removed
                return value
            except ValueError:
                # print(f"      [find_nearest_number] Error: Could not convert fallback (not g, not %) number '{selected_value_str}' to float.") # Debug print removed
                pass # Keep pass

    all_numbers_general = re.findall(r"(\d+(?:\.\d+)?|\.\d+)(?!\s*[%])", processed_segment)
    # print(f"      [find_nearest_number] Fallback Num Regex (general, excluding %): {all_numbers_general}") # Debug print removed
    if all_numbers_general:
        try:
            num_str = all_numbers_general[0]
            if re.search(re.escape(num_str) + r"\s*%", processed_segment):
                # print(f"      [find_nearest_number] Info: Fallback number '{num_str}' appears to be part of a percentage (e.g., '{num_str}%'). Trying next if any.") # Debug print removed
                if len(all_numbers_general) > 1:
                    num_str = all_numbers_general[1]
                    if not re.search(re.escape(num_str) + r"\s*%", processed_segment):
                        # print(f"      [find_nearest_number] Match: Using second Fallback Value -> {float(num_str)}") # Debug print removed
                        return float(num_str)
                    # else: # This else block only contained a print
                        # print(f"      [find_nearest_number] Info: Second fallback number '{num_str}' also appears part of a percentage.") # Debug print removed
                # print(f"      [find_nearest_number] Result: Fallback number '{all_numbers_general[0]}' was part of percentage, no other fallback taken.") # Debug print removed
                return None
            
            value = float(num_str)
            # print(f"      [find_nearest_number] Match: Using Fallback Value -> {value}") # Debug print removed
            return value
        except ValueError:
            # print(f"      [find_nearest_number] Error: Could not convert fallback number '{all_numbers_general[0]}' to float.") # Debug print removed
            pass # Keep pass

    # print("      [find_nearest_number] Result: No valid number found.") # Debug print removed
    return None


def parse_nutrition_text_proximity(text: str) -> dict[str, Optional[float]]:
    """Parses raw OCR text using keyword proximity and structure to find nutrient values."""
    processed_text = text.lower()
    # print("--- [parse_nutrition_text_proximity] Start Parsing ---") # F541 fix, and debug print removed
    # print(f"Input Text (lowercase, first 500 chars):\n{processed_text[:500]}") # Debug print removed

    keywords = {
        "total_fat": ["total fat", "total fal", "fat", "grasa total", "grasa"],
        "protein": ["protein", "proteínas", "proteína"],
        "total_carbohydrate": ["total carbohydrate", "carbohydrate", "carbohidrato total", "carbohidrato"],
        "dietary_fiber": ["dietary fiber", "fiber", "fibra dietética", "fibra", "diary tiber", "deary her"], 
        "total_sugars": ["total sugars", "azúcares totales", "sugars", "azúcares"], 
        "servings": ["servings per container", "raciones por envase"] 
    }

    extracted_data: Dict[str, float] = {
        "protein": 1.0, 
        "total_fat": 1.0,
        "total_carbohydrate": 1.0,
        "dietary_fiber": 1.0,
        "total_sugars": 1.0,
        "servings": 1.0, 
    }

    lines = [line.strip() for line in processed_text.split('\n') if line.strip()]
    # print(f"Split into {len(lines)} non-empty lines.") # Debug print removed

    def check_for_explicit_zero(segment_after_keyword: str, line_where_keyword_found: str, next_line_text_for_zero_check: str) -> bool:
        """Checks for explicit zero patterns, prioritizing the segment immediately after the keyword."""
        zero_patterns = [r"\b0\s*g\b", r"\bo\s*g\b", r"\bzero\s*g\b"]
        
        if segment_after_keyword:
            for zero_pattern in zero_patterns:
                if re.search(zero_pattern, segment_after_keyword, re.IGNORECASE):
                    # print(f"      INFO: Explicit zero pattern '{zero_pattern}' found in segment_after_keyword: '{segment_after_keyword}'.") # Debug print removed
                    return True

        for zero_pattern in zero_patterns:
            if re.search(zero_pattern, line_where_keyword_found, re.IGNORECASE):
                # print(f"      INFO: Explicit zero pattern '{zero_pattern}' found on line_where_keyword_found: '{line_where_keyword_found}'.") # Debug print removed
                return True
        
        if not segment_after_keyword.strip():
            if next_line_text_for_zero_check:
                for zero_pattern in zero_patterns:
                    if re.search(zero_pattern, next_line_text_for_zero_check, re.IGNORECASE):
                        # print(f"      INFO: Explicit zero pattern '{zero_pattern}' found on next_line (keyword was at EOL): '{next_line_text_for_zero_check}'.") # Debug print removed
                        return True
        return False

    # --- Main Nutrient Processing Loop --- #
    for key, terms in keywords.items():
        # print(f"\nProcessing Nutrient: [{key}] (Keywords: {', '.join(terms)})") # Debug print removed
        keyword_found_on_line = -1
        term = "" # Store the specific term that was matched
        explicit_primary_keyword_found = False
        value_found_on_current_line_segment = False
        value_found_on_next_line = False
        segment_after_keyword = ""
        next_line_segment = ""

        # Find the keyword line and specific term
        if key == "total_sugars":
            primary_sugar_terms = ["total sugars", "azúcares totales"]
            for i_line, line_text in enumerate(lines):
                for term_to_check in primary_sugar_terms:
                    if term_to_check in line_text:
                        keyword_found_on_line = i_line
                        term = term_to_check
                        explicit_primary_keyword_found = True
                        # print(f"    -> Found PRIORITY keyword '{term}' for '{key}' on line {i_line}") # Debug print removed
                        break
                if explicit_primary_keyword_found:
                    break
            if not explicit_primary_keyword_found:
                # print(f"    INFO: [{key}] Primary terms not found. Expanding search.") # Debug print removed
                pass # Keep explicit pass for clarity after print removal
        
        if not explicit_primary_keyword_found:
            for i, line_text in enumerate(lines):
                for t in terms:
                    if t in line_text:
                        keyword_found_on_line = i
                        term = t
                        # print(f"    -> Found keyword '{term}' for '{key}' on line {i}") # Debug print removed
                        break
                if term:
                    break
        
        if keyword_found_on_line != -1:
            current_line_text = lines[keyword_found_on_line]
            parsed_value_for_key: Optional[float] = None

            if key == "servings":
                parsed_value_for_key = find_nearest_number(current_line_text, prioritize_grams=False)
            else:
                try:
                    segment_after_keyword = current_line_text[current_line_text.find(term) + len(term):]
                except TypeError: # term might not be found if logic error upstream
                    segment_after_keyword = "" # Default to empty if term not found
                    # print(f"    ERROR: Term '{term}' not found in line '{current_line_text}' for key '{key}'. This is unexpected.") # Error print removed, considered part of debug for now

                parsed_value_for_key = find_nearest_number(segment_after_keyword)
                if parsed_value_for_key is not None:
                    value_found_on_current_line_segment = True
                else:
                    if keyword_found_on_line + 1 < len(lines):
                        next_line_segment = lines[keyword_found_on_line+1]
                        parsed_value_for_key = find_nearest_number(next_line_segment)
                        if parsed_value_for_key is not None:
                            value_found_on_next_line = True
            
            if parsed_value_for_key is not None:
                # Apply heuristics if a number was parsed
                if key in ["total_carbohydrate", "dietary_fiber", "total_sugars"] and parsed_value_for_key >= 10:
                    # ... (g->0 heuristic, substantially the same) ...
                    original_text_for_value = ""
                    if value_found_on_current_line_segment:
                        original_text_for_value = segment_after_keyword.strip()
                    elif value_found_on_next_line:
                        original_text_for_value = next_line_segment.strip()
                    if original_text_for_value:
                        parsed_value_int_str = str(int(parsed_value_for_key))
                        if original_text_for_value == parsed_value_int_str and parsed_value_int_str.endswith('0'):
                            corrected_value = parsed_value_for_key / 10
                            # print(f"    -> HEURISTIC G->0 APPLIED: {parsed_value_for_key} -> {corrected_value}") # Debug print removed
                            parsed_value_for_key = corrected_value

                if key in ["protein", "total_fat", "total_carbohydrate", "dietary_fiber", "total_sugars"] and parsed_value_for_key is not None:
                    # ... (g->9 heuristic, substantially the same) ...
                    original_text_for_value_g9 = ""
                    if value_found_on_current_line_segment:
                        original_text_for_value_g9 = segment_after_keyword.strip()
                    elif value_found_on_next_line:
                        original_text_for_value_g9 = next_line_segment.strip()
                    if original_text_for_value_g9:
                        parsed_value_int_str_g9 = str(int(parsed_value_for_key))
                        if original_text_for_value_g9 == parsed_value_int_str_g9 and original_text_for_value_g9.endswith('9') and len(original_text_for_value_g9) > 1:
                            try:
                                corrected_value_g9 = float(original_text_for_value_g9[:-1])
                                # print(f"    -> HEURISTIC G->9 APPLIED: {parsed_value_for_key} -> {corrected_value_g9}") # Debug print removed
                                parsed_value_for_key = corrected_value_g9
                            except ValueError:
                                pass # Ignore conversion error for G9 heuristic

                extracted_data[key] = parsed_value_for_key
                # print(f"      SUCCESS: Assigned PARSED value {extracted_data[key]} to '{key}'.") # Debug print removed
            else:
                # No number parsed, check for explicit zero
                # print(f"    -> INFO: No number parsed for '{key}'. Checking for explicit zero.") # Debug print removed
                line_where_keyword_was_found = lines[keyword_found_on_line]
                next_line_for_zero_check = lines[keyword_found_on_line+1] if keyword_found_on_line + 1 < len(lines) else ""
                
                if check_for_explicit_zero(segment_after_keyword, line_where_keyword_was_found, next_line_for_zero_check):
                    extracted_data[key] = 0.0
                    # print(f"      SUCCESS: Assigned EXPLICIT ZERO 0.0 to '{key}'.") # Debug print removed
                else:
                    significant_source_phrases = ["not a significant source", "insignificant source"]
                    source_phrase_found = False
                    for phrase in significant_source_phrases:
                        if phrase in line_where_keyword_was_found.lower() or phrase in next_line_for_zero_check.lower():
                            extracted_data[key] = 0.0
                            # print(f"      INFO: Found zero phrase '{phrase}' for '{key}'. Assigning 0.0.") # Debug print removed
                            source_phrase_found = True
                            break
                    if not source_phrase_found:
                        # print(f"    -> INFO: No explicit zero for '{key}'. Remains default {extracted_data.get(key)}.") # Debug print removed
                        pass # Keep explicit pass for clarity
        else:
            # print(f"    WARNING: No keyword found for '{key}'. Remains default {extracted_data[key]}.") # This is a useful warning, but for now treating as debug remove. Consider re-adding if issues arise.
            pass # Keep explicit pass for clarity
        
        # print(f"-> Final value for [{key}]: {extracted_data[key]}") # Debug print removed

    # print("--- [parse_nutrition_text_proximity] Finished --- Result: {extracted_data}") # Debug print removed
    return extracted_data



# --- Endpoint definition ---

@router.post("/process-label", response_model=OcrResponse)
async def process_label(image: UploadFile):
    """Accepts an image file, performs OCR using Google Vision, and returns raw text."""
    if vision_client is None:
        print("ERROR: /process-label called but Google Vision client is not initialized.")
        raise HTTPException(
            status_code=500,
            detail="OCR service is not configured correctly. Check API key/credentials."
        )

    try:
        # Read image content
        content = await image.read()
        if not content:
            raise HTTPException(status_code=400, detail="Received an empty image file.")

        # Prepare image for Google Vision
        vision_image = vision.Image(content=content)

        # Perform text detection
        # print(f"[process_label] Sending image ({len(content)} bytes) to Google Vision API...") # Debug print removed
        try:
            response = vision_client.text_detection(image=vision_image)
            # print("[process_label] Received response from Google Vision API.") # Debug print removed
        except ServiceUnavailable as e:
            print(f"ERROR processing image in /process-label (Google Vision Service Unavailable): {e}")
            raise HTTPException(
                status_code=503, 
                detail=f"The OCR service (Google Vision) is temporarily unavailable: {e}"
            ) from e
        except GoogleAPIError as e:
            print(f"ERROR processing image in /process-label (Google API Error): {e}")
            raise HTTPException(
                status_code=502, # Bad Gateway might be appropriate here
                detail=f"Error communicating with the OCR service (Google Vision): {e}"
            ) from e
        # Removed the generic Exception handler here as it's caught later

        # Handle Vision API functional errors if any (e.g., bad image format, no text found)
        if response.error.message:
            print(f"[process_label] Google Vision API Functional Error: {response.error.message}")
            # Consider if this should be 400 (Bad Request) or 500 based on error type
            raise HTTPException(
                status_code=400, # Likely a client-side issue if Vision reports an error
                detail=f"Google Vision API Error: {response.error.message}"
            ) from response.error # Or from None if not chaining system error

        # Extract text
        extracted_text = response.full_text_annotation.text
        # print(f"[process_label] Extracted Text (first 500 chars): {extracted_text[:500]}...") # Debug print removed
        # if len(extracted_text) < 1500: # Conditional debug print removed
            # print(f"[process_label] Full Extracted Text (since < 1500 chars):\n{extracted_text}")

        if not extracted_text:
            print("WARNING: [process_label] No text detected in the image.") # Kept as warning
            # Return empty string or raise exception based on desired behavior
            # Return empty for now
            extracted_text = ""
            # Return OcrResponse with default values if no text detected
            # All fields in OcrResponse are now non-optional and will have defaults from initialization
            # or the model's own defaults if not provided during initialization.
            # To ensure our 1.0 default is used if parser isn't even called:
            default_data_for_empty_text = {
                "protein": 1.0,
                "total_fat": 1.0,
                "total_carbohydrate": 1.0,
                "dietary_fiber": 1.0,
                "total_sugars": 1.0,
                "servings": 1.0, 
            }
            # print("[process_label] No text detected. Returning default OcrResponse.") # Debug print removed
            return OcrResponse(**default_data_for_empty_text) 

        # Parse the extracted text to get structured data
        # print("[process_label] Calling parser...") # Debug print removed
        parsed_data = parse_nutrition_text_proximity(extracted_text) # New proximity method
        # print(f"[process_label] Parser returned: {parsed_data}") # Debug print removed
        
        # Return the structured data
        # print("[process_label] Returning OcrResponse.") # Debug print removed
        return OcrResponse(**parsed_data)

    except HTTPException as http_exc:
        # Re-raise HTTPExceptions directly
        raise http_exc
    except Exception as e:
        print(f"ERROR processing image in /process-label: {e}")
        # Log the full error for debugging
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during OCR processing: {e}"
        ) from e
