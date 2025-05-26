/** Body_process_label */
export interface BodyProcessLabel {
  /**
   * Image
   * @format binary
   */
  image: File;
}

/** CalculationRequest */
export interface CalculationRequest {
  /** Aggregated nutritional data for all items in the cart */
  aggregated_input_data: MacroNutrients;
  /**
   * Anchor Id
   * The macronutrient to anchor the balancing algorithm (e.g., 'Protein', 'Fat', 'TotalCarbs', 'Fiber', 'Sugar')
   */
  anchor_id: string;
}

/** CastleVerdeIndexResponse */
export interface CastleVerdeIndexResponse {
  /**
   * Predicted Spike
   * User-facing score (15-50). Meaning depends on ENABLE_BALANCE_SCORE flag.
   */
  predicted_spike: number;
  /** The original input macronutrient breakdown provided in the request */
  input_data: MacroNutrients;
  /** The ideal balanced macronutrient breakdown based on the anchor and fixed ratio (excludes net_carbs) */
  balanced_macros: MacroNutrients;
  /**
   * Base Ratio
   * Calculated base ratio for tier classification: ((Sugar + Net Carbs) + 1) / (Protein + Fiber + 1)
   */
  base_ratio: number;
  /**
   * Tier Label
   * Tier label based on the base_ratio (e.g., 'Balanced', 'Caution')
   */
  tier_label: string;
  /**
   * Tier Color
   * Color corresponding to the tier (e.g., 'green', 'yellow')
   */
  tier_color: string;
}

/**
 * ExtractedMacrosResponse
 * Response model containing the estimated macronutrient values.
 */
export interface ExtractedMacrosResponse {
  /**
   * Protein
   * Estimated protein in grams.
   */
  protein?: number | null;
  /**
   * Fat
   * Estimated total fat in grams.
   */
  fat?: number | null;
  /**
   * Total Carbs
   * Estimated total carbohydrates in grams.
   */
  total_carbs?: number | null;
  /**
   * Sugar
   * Estimated total sugars in grams.
   */
  sugar?: number | null;
  /**
   * Fiber
   * Estimated dietary fiber in grams.
   */
  fiber?: number | null;
}

/**
 * FoodLookupRequest
 * Request model containing the name of the food item.
 */
export interface FoodLookupRequest {
  /**
   * Food Name
   * The name of the food item to look up.
   */
  food_name: string;
}

/** HTTPValidationError */
export interface HTTPValidationError {
  /** Detail */
  detail?: ValidationError[];
}

/** HealthResponse */
export interface HealthResponse {
  /** Status */
  status: string;
}

/** MacroNutrients */
export interface MacroNutrients {
  /**
   * Protein
   * Protein in grams
   */
  protein: number;
  /**
   * Fat
   * Fat in grams
   */
  fat: number;
  /**
   * Total Carbs
   * Total Carbohydrates in grams
   */
  total_carbs: number;
  /**
   * Fiber
   * Fiber in grams
   */
  fiber: number;
  /**
   * Sugar
   * Sugar in grams
   */
  sugar: number;
  /**
   * Net Carbs
   * Net Carbohydrates (Total Carbs - Fiber) in grams. Only used internally.
   */
  net_carbs?: number | null;
}

/**
 * OcrResponse
 * Response model containing the structured nutrient data extracted from the image.
 */
export interface OcrResponse {
  /** Protein */
  protein: number;
  /** Total Fat */
  total_fat: number;
  /** Total Carbohydrate */
  total_carbohydrate: number;
  /** Dietary Fiber */
  dietary_fiber: number;
  /** Total Sugars */
  total_sugars: number;
  /** Servings */
  servings: number;
}

/** ValidationError */
export interface ValidationError {
  /** Location */
  loc: (string | number)[];
  /** Message */
  msg: string;
  /** Error Type */
  type: string;
}

export type CheckHealthData = HealthResponse;

export type ChatgptFoodLookupData = ExtractedMacrosResponse;

export type ChatgptFoodLookupError = HTTPValidationError;

export type CalculateCastleVerdeIndexData = CastleVerdeIndexResponse;

export type CalculateCastleVerdeIndexError = HTTPValidationError;

export type ProcessLabelData = OcrResponse;

export type ProcessLabelError = HTTPValidationError;
