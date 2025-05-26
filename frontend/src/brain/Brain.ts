import {
  BodyProcessLabel,
  CalculateCastleVerdeIndexData,
  CalculateCastleVerdeIndexError,
  CalculationRequest,
  ChatgptFoodLookupData,
  ChatgptFoodLookupError,
  CheckHealthData,
  FoodLookupRequest,
  ProcessLabelData,
  ProcessLabelError,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class Brain<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * @description Check health of application. Returns 200 when OK, 500 when not.
   *
   * @name check_health
   * @summary Check Health
   * @request GET:/_healthz
   */
  check_health = (params: RequestParams = {}) =>
    this.request<CheckHealthData, any>({
      path: `/_healthz`,
      method: "GET",
      ...params,
    });

  /**
   * @description Receives a food name, queries OpenAI (GPT model) to estimate its macronutrients (protein, fat, total carbs, sugar, fiber), and returns them in a structured JSON format.
   *
   * @tags dbtn/module:chatgpt_lookup
   * @name chatgpt_food_lookup
   * @summary Chatgpt Food Lookup
   * @request POST:/routes/chatgpt-food-lookup
   */
  chatgpt_food_lookup = (data: FoodLookupRequest, params: RequestParams = {}) =>
    this.request<ChatgptFoodLookupData, ChatgptFoodLookupError>({
      path: `/routes/chatgpt-food-lookup`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * No description
   *
   * @tags CastleVerdeIndex, dbtn/module:castle_verde_index
   * @name calculate_castle_verde_index
   * @summary Calculate Castle Verde Index
   * @request POST:/routes/castle-verde/calculate-index
   */
  calculate_castle_verde_index = (data: CalculationRequest, params: RequestParams = {}) =>
    this.request<CalculateCastleVerdeIndexData, CalculateCastleVerdeIndexError>({
      path: `/routes/castle-verde/calculate-index`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Accepts an image file, performs OCR using Google Vision, and returns raw text.
   *
   * @tags dbtn/module:ocr
   * @name process_label
   * @summary Process Label
   * @request POST:/routes/process-label
   */
  process_label = (data: BodyProcessLabel, params: RequestParams = {}) =>
    this.request<ProcessLabelData, ProcessLabelError>({
      path: `/routes/process-label`,
      method: "POST",
      body: data,
      type: ContentType.FormData,
      ...params,
    });
}
