import databutton as db
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from openai import OpenAI
import json

# --- Pydantic Models ---

class FoodLookupRequest(BaseModel):
    """Request model containing the name of the food item."""
    food_name: str = Field(..., description="The name of the food item to look up.")

class ExtractedMacrosResponse(BaseModel):
    """Response model containing the estimated macronutrient values."""
    protein: float | None = Field(None, description="Estimated protein in grams.")
    fat: float | None = Field(None, description="Estimated total fat in grams.")
    total_carbs: float | None = Field(None, description="Estimated total carbohydrates in grams.")
    sugar: float | None = Field(None, description="Estimated total sugars in grams.")
    fiber: float | None = Field(None, description="Estimated dietary fiber in grams.")

# --- FastAPI Router ---

router = APIRouter()

# --- OpenAI Client Initialization ---
# Use the stored secret key
try:
    openai_api_key = db.secrets.get("OPENAI_API_KEY")
    if not openai_api_key:
        print("Warning: OPENAI_API_KEY secret is not set. Lookup endpoint will fail.")
        # You might want to raise an error or handle this case depending on requirements
        # For now, let it proceed and fail during the request if key is missing.
    client = OpenAI(api_key=openai_api_key)
except Exception as e:
    print(f"Error initializing OpenAI client: {e}")
    # Handle initialization error appropriately
    client = None # Ensure client is None if initialization fails


# --- Helper Function for Prompt ---

def create_openai_prompt(food_name: str) -> list[dict]:
    """Creates the structured prompt for OpenAI to extract macros."""
    system_message = """
You are a nutritional database expert specializing in estimating macronutrients for a typical single serving size.
Given a food name, respond ONLY with the estimated values in GRAMS for:
- Protein (g)
- Fat (g) (meaning Total Fat)
- Carbohydrates (g) (meaning Total Carbohydrates)
- Sugar (g) (meaning Total Sugars)
- Fiber (g) (meaning Dietary Fiber)

Your response MUST be ONLY a valid JSON object with the keys 'protein', 'fat', 'carbs', 'sugar', 'fiber'.
Use numbers for the values (e.g., 10.5 or 10, not '10 g'). If a value is unknown or typically zero, use null or 0 respectively.
Example format: { "protein": 10, "fat": 5.5, "carbs": 25, "sugar": 8, "fiber": 3 }
Do NOT include any text before or after the JSON object.
Do NOT use markdown formatting like ```json ... ```.
Base your estimations on a standard, common serving size for the specified food.
"""
    user_message = f"Estimate the macronutrients for a typical serving of: {food_name}"

    return [
        {"role": "system", "content": system_message.strip()},
        {"role": "user", "content": user_message}
    ]

# --- API Endpoint ---

@router.post("/chatgpt-food-lookup", response_model=ExtractedMacrosResponse)
async def chatgpt_food_lookup(request: FoodLookupRequest):
    """
    Receives a food name, queries OpenAI (GPT model) to estimate its macronutrients
    (protein, fat, total carbs, sugar, fiber), and returns them in a structured JSON format.
    """
    print(f"Received food lookup request for: {request.food_name}")

    if not client:
        print("Error: OpenAI client not initialized (likely missing API key).")
        raise HTTPException(status_code=500, detail="OpenAI client not available. Check API key configuration.")

    prompt_messages = create_openai_prompt(request.food_name)
    model_to_use = "gpt-4o-mini" # Using recommended model

    try:
        print(f"Sending request to OpenAI model: {model_to_use}")
        completion = client.chat.completions.create(
            model=model_to_use,
            messages=prompt_messages,
            temperature=0.2, # Lower temperature for more deterministic JSON output
            response_format={"type": "json_object"} # Request JSON output explicitly
        )

        raw_response = completion.choices[0].message.content
        print(f"Raw response from OpenAI: {raw_response}")

        if not raw_response:
            print("Error: Received empty response from OpenAI.")
            raise HTTPException(status_code=500, detail="Received empty response from OpenAI.")

        # Parse the JSON response
        try:
            parsed_data = json.loads(raw_response)
            print(f"Parsed JSON data: {parsed_data}")

            # Validate and extract data - use .get() for robustness
            protein = parsed_data.get('protein')
            fat = parsed_data.get('fat')
            total_carbs = parsed_data.get('carbs') # Key from prompt is 'carbs'
            sugar = parsed_data.get('sugar')
            fiber = parsed_data.get('fiber')

            # Basic type checking/conversion (optional but recommended)
            def safe_float(val):
                if val is None:
                    return None
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return None

            response_data = ExtractedMacrosResponse(
                protein=safe_float(protein),
                fat=safe_float(fat),
                total_carbs=safe_float(total_carbs),
                sugar=safe_float(sugar),
                fiber=safe_float(fiber)
            )
            print(f"Returning structured response: {response_data}")
            return response_data

        except json.JSONDecodeError as e: # Added 'as e' for 'from e'
            print(f"Error: Failed to decode JSON response from OpenAI: {raw_response}")
            raise HTTPException(status_code=500, detail="Invalid JSON response received from AI.") from e
        except Exception as e:
            print(f"Error processing parsed JSON data: {e}")
            raise HTTPException(status_code=500, detail="Error processing AI response data.") from e

    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        # Consider more specific error handling based on OpenAI exceptions if needed
        raise HTTPException(status_code=502, detail=f"Failed to get estimation from AI: {str(e)}") from e
