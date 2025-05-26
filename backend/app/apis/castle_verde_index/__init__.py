# src/app/apis/castle_verde_index/__init__.py
import random
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Optional

router = APIRouter(prefix="/castle-verde", tags=["CastleVerdeIndex"])

# --- Pydantic Models ---

class MacroNutrients(BaseModel):
    protein: float = Field(..., description="Protein in grams")
    fat: float = Field(..., description="Fat in grams")
    total_carbs: float = Field(..., description="Total Carbohydrates in grams")
    fiber: float = Field(..., description="Fiber in grams")
    sugar: float = Field(..., description="Sugar in grams")
    net_carbs: Optional[float] = Field(None, description="Net Carbohydrates (Total Carbs - Fiber) in grams. Only used internally.")

class CalculationRequest(BaseModel):
    aggregated_input_data: MacroNutrients = Field(..., description="Aggregated nutritional data for all items in the cart")
    anchor_id: str = Field(..., description="The macronutrient to anchor the balancing algorithm (e.g., 'Protein', 'Fat', 'TotalCarbs', 'Fiber', 'Sugar')")

class CastleVerdeIndexResponse(BaseModel):
    predicted_spike: float = Field(..., description="User-facing score (15-50). Meaning depends on ENABLE_BALANCE_SCORE flag.")
    input_data: MacroNutrients = Field(..., description="The original input macronutrient breakdown provided in the request")
    balanced_macros: MacroNutrients = Field(..., description="The ideal balanced macronutrient breakdown based on the anchor and fixed ratio (excludes net_carbs)")
    base_ratio: float = Field(..., description="Calculated base ratio for tier classification: ((Sugar + Net Carbs) + 1) / (Protein + Fiber + 1)")
    tier_label: str = Field(..., description="Tier label based on the base_ratio (e.g., 'Balanced', 'Caution')")
    tier_color: str = Field(..., description="Color corresponding to the tier (e.g., 'green', 'yellow')")

# --- Helper Functions ---

CASTLE_VERDE_RATIO = {
    "protein": 4,
    "fiber": 2,
    "fat": 3,
    "sugar": 1,
    "total_carbs": 2,
}
VALID_ANCHOR_KEYS = [key.lower() for key in CASTLE_VERDE_RATIO.keys()]

def calculate_net_carbs(macros: MacroNutrients, include_fiber: bool = True) -> float:
    """Calculate net carbs, optionally excluding fiber."""
    total_carbs = max(0.0, macros.total_carbs or 0.0)
    fiber_val = max(0.0, macros.fiber or 0.0)
    
    if include_fiber:
        return max(0.0, total_carbs - fiber_val)
    else:
        return total_carbs

def _internal_balance_calc(input_data: MacroNutrients, anchor_id: str) -> MacroNutrients:
    anchor_key_lower = anchor_id.lower().replace(" ", "_").replace("-", "_")
    if anchor_key_lower == "totalcarbs":
        anchor_key_lower = "total_carbs"
    if anchor_key_lower not in VALID_ANCHOR_KEYS:
        raise HTTPException(status_code=400, detail=f"Invalid anchor key: '{anchor_id}'. Valid keys are: Protein, Fiber, Fat, Sugar, TotalCarbs")
        
    try:
        input_data_dict = input_data.dict()
        actual_anchor_grams = input_data_dict.get(anchor_key_lower, 0.0) or 0.0
        actual_anchor_grams = max(0.0, actual_anchor_grams)
    except AttributeError as e:
         raise HTTPException(status_code=500, detail="Internal error accessing nutrient data.") from e

    anchor_processing_factor = CASTLE_VERDE_RATIO[anchor_key_lower]
    
    if anchor_processing_factor == 0:
        raise HTTPException(status_code=500, detail=f"Internal configuration error: Processing factor for anchor '{anchor_key_lower}' is zero.")
        
    adjustment_factor = 0.0
    if actual_anchor_grams > 0 and anchor_processing_factor != 0:
        adjustment_factor = actual_anchor_grams / anchor_processing_factor
            
    output_dict: Dict[str, float] = {}
    for key, proc_factor in CASTLE_VERDE_RATIO.items():
        if key == anchor_key_lower:
            output_dict[key] = actual_anchor_grams
        else:
            output_dict[key] = max(0.0, adjustment_factor * proc_factor)
            
    final_balanced_data = {
        "protein": output_dict.get("protein", 0.0),
        "fat": output_dict.get("fat", 0.0),
        "total_carbs": output_dict.get("total_carbs", 0.0),
        "fiber": output_dict.get("fiber", 0.0),
        "sugar": output_dict.get("sugar", 0.0),
    }

    try:
        balanced_result_obj = MacroNutrients(**final_balanced_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error creating balanced macro data: {e}") from e
    return balanced_result_obj

def _calculate_raw_gsp(input_macros: MacroNutrients, include_fiber: bool = True) -> float:
    proc_net_carbs = calculate_net_carbs(input_macros, include_fiber)
    proc_sugar = max(0.0, input_macros.sugar or 0.0)
    proc_protein = max(0.0, input_macros.protein or 0.0)
    # proc_fat = max(0.0, input_macros.fat or 0.0) # Unused variable
    proc_fiber = max(0.0, input_macros.fiber or 0.0) # Renamed from proc_fat for clarity, ensure this is used if needed or removed

    numerator = (proc_sugar + proc_net_carbs) + 1.0
    denominator = proc_protein + proc_fiber + 1.0 # Using proc_fiber as per previous logic

    if denominator <= 0: # Should not be strictly necessary due to +1.0, but for safety.
        return 0.0 

    base_ratio = numerator / denominator
    raw_gsp_score_pre_alpha_beta = base_ratio ** 1.5

    alpha = 3.28
    beta = 1.5
    final_raw_gsp = alpha * (raw_gsp_score_pre_alpha_beta ** beta)
    return final_raw_gsp

# --- API Endpoint ---

@router.post("/calculate-index", response_model=CastleVerdeIndexResponse)
def calculate_castle_verde_index(request: CalculationRequest):
    input_macros_obj = request.aggregated_input_data.copy(deep=True)

    ENABLE_BALANCE_SCORE = True # This flag determines which logic is used for predicted_spike
    
    # Raw GSP is always calculated for potential fallback or internal use
    include_fiber_in_raw_gsp_net_carbs = True 
    raw_gsp_value = _calculate_raw_gsp(input_macros_obj, include_fiber=include_fiber_in_raw_gsp_net_carbs)
    noise_gsp = random.uniform(-0.05, 0.05)
    raw_gsp_with_noise = max(0.0, raw_gsp_value + noise_gsp)

    final_user_facing_score: float

    if ENABLE_BALANCE_SCORE:
        # New Ratio-Based Logic with sharper curve
        protein_g = float(input_macros_obj.protein or 0.0)
        fiber_g = float(input_macros_obj.fiber or 0.0)
        fat_g = float(input_macros_obj.fat or 0.0)
        
        total_carbs_g = float(input_macros_obj.total_carbs or 0.0)
        sugar_g = float(input_macros_obj.sugar or 0.0)

        net_carbs_g = max(0.0, total_carbs_g - fiber_g)

        group1_good_weight = protein_g + fiber_g + fat_g
        group2_bad_weight = net_carbs_g + sugar_g
        
        # Calculate raw_ratio with 1e-5 epsilon
        raw_ratio = group2_bad_weight / (group1_good_weight + 1e-5) 
        
        # Apply multiplier to raw_ratio
        adjusted_ratio = raw_ratio * 1.15
        
        # Apply new scaling formula with exponent 1.35 to the adjusted_ratio

        clamped_adjusted_ratio = min(adjusted_ratio, 3.0)
        exponent_val = 1.35 # New exponent
        
        exponentiated_clamped_adjusted_ratio = clamped_adjusted_ratio ** exponent_val
        # Denominator uses the same capping point (3.0) for the reference max effect on the curve
        max_possible_exponentiated_value_at_cap = 3.0 ** exponent_val 
        
        if max_possible_exponentiated_value_at_cap == 0: # Should not happen with 3.0 and positive exponent
            if group2_bad_weight > 0: 
                normalized_score = 50.0
            else: 
                normalized_score = 15.0
        else:
            scale_factor = (50.0 - 15.0) / max_possible_exponentiated_value_at_cap
            normalized_score = 15.0 + exponentiated_clamped_adjusted_ratio * scale_factor
            
        final_user_facing_score = round(normalized_score, 2)
        
    else:
        # Fallback to previous GSP-based scaling logic (exponent 1.05, raw_max 120)
        raw_max_for_scaling = 120.0
        gsp_to_scale = float(raw_gsp_with_noise or 0.0)
        
        value_for_scaling = max(0.0, min(gsp_to_scale, raw_max_for_scaling))
        scaled_gsp_fallback = 15.0 + ((value_for_scaling / raw_max_for_scaling) ** 1.05) * (50.0 - 15.0)
        final_user_facing_score = round(scaled_gsp_fallback, 2)

    # Balanced macros calculation (remains unchanged)
    balanced_macros_obj = _internal_balance_calc(input_macros_obj.copy(deep=True), request.anchor_id)
    
    noisy_balanced_macros_data = {}
    noise_range_grams = 0.02
    for key, value in balanced_macros_obj.dict(exclude_none=True).items():
        if key != 'net_carbs' and isinstance(value, (int, float)): 
             noise_grams = random.uniform(-noise_range_grams, noise_range_grams)
             noisy_value = max(0.0, value + noise_grams) 
             noisy_balanced_macros_data[key] = round(noisy_value, 3) 
        else:
             noisy_balanced_macros_data[key] = value
    final_balanced_macros_with_noise = MacroNutrients(**noisy_balanced_macros_data)

    # Tier classification calculation (remains unchanged)
    tier_input_macros = request.aggregated_input_data.copy(deep=True)
    tier_net_carbs = calculate_net_carbs(tier_input_macros, include_fiber=include_fiber_in_raw_gsp_net_carbs)
    tier_sugar = max(0.0, float(tier_input_macros.sugar or 0.0))
    tier_protein = max(0.0, float(tier_input_macros.protein or 0.0))
    tier_fiber_for_tier_denom = max(0.0, float(tier_input_macros.fiber or 0.0))

    tier_numerator = (tier_sugar + tier_net_carbs) + 1.0
    tier_denominator = (tier_protein + tier_fiber_for_tier_denom) + 1.0
    base_ratio_for_tier = tier_numerator / tier_denominator if tier_denominator != 0 else float('inf') # Should not be 0 due to +1.0

    if base_ratio_for_tier < 20:
        tier_label = "Balanced"
        tier_color = "green"
    elif base_ratio_for_tier <= 30:
        tier_label = "Caution"
        tier_color = "yellow"
    elif base_ratio_for_tier <= 40:
        tier_label = "High Spike"
        tier_color = "red"
    else:
        tier_label = "Danger Zone"
        tier_color = "light_navy_blue"

    return CastleVerdeIndexResponse(
        predicted_spike=final_user_facing_score,
        input_data=request.aggregated_input_data,
        balanced_macros=final_balanced_macros_with_noise,
        base_ratio=base_ratio_for_tier,
        tier_label=tier_label,
        tier_color=tier_color
    )
