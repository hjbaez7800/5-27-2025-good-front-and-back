import {
  BodyProcessLabel,
  CalculateCastleVerdeIndexData,
  CalculationRequest,
  ChatgptFoodLookupData,
  CheckHealthData,
  FoodLookupRequest,
  ProcessLabelData,
} from "./data-contracts";

export namespace Brain {
  /**
   * @description Check health of application. Returns 200 when OK, 500 when not.
   * @name check_health
   * @summary Check Health
   * @request GET:/_healthz
   */
  export namespace check_health {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = CheckHealthData;
  }

  /**
   * @description Receives a food name, queries OpenAI (GPT model) to estimate its macronutrients (protein, fat, total carbs, sugar, fiber), and returns them in a structured JSON format.
   * @tags dbtn/module:chatgpt_lookup
   * @name chatgpt_food_lookup
   * @summary Chatgpt Food Lookup
   * @request POST:/routes/chatgpt-food-lookup
   */
  export namespace chatgpt_food_lookup {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = FoodLookupRequest;
    export type RequestHeaders = {};
    export type ResponseBody = ChatgptFoodLookupData;
  }

  /**
   * No description
   * @tags CastleVerdeIndex, dbtn/module:castle_verde_index
   * @name calculate_castle_verde_index
   * @summary Calculate Castle Verde Index
   * @request POST:/routes/castle-verde/calculate-index
   */
  export namespace calculate_castle_verde_index {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = CalculationRequest;
    export type RequestHeaders = {};
    export type ResponseBody = CalculateCastleVerdeIndexData;
  }

  /**
   * @description Accepts an image file, performs OCR using Google Vision, and returns raw text.
   * @tags dbtn/module:ocr
   * @name process_label
   * @summary Process Label
   * @request POST:/routes/process-label
   */
  export namespace process_label {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = BodyProcessLabel;
    export type RequestHeaders = {};
    export type ResponseBody = ProcessLabelData;
  }
}
