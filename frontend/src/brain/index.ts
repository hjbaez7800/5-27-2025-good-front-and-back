import { API_HOST, API_PATH, API_PREFIX_PATH } from "../constants";
import { Brain } from "./Brain";
import type { RequestParams } from "./http-client";

const isLocalhost = /localhost:\d{4}/i.test(window.location.origin);

const constructBaseUrl = (): string => {
  if (isLocalhost) {
    // In workspace (dev)
    return `${window.location.origin}${API_PATH}`;
  }

  if (API_HOST) {
  // In deployed app (prod)
  return API_HOST;
}

  // In deployed app (prod)
  return `https://api.databutton.com${API_PATH}`;
};

type BaseApiParams = Omit<RequestParams, "signal" | "baseUrl" | "cancelToken">;

const constructBaseApiParams = (): BaseApiParams => {
  return {
    credentials: "include",
  };
};

const constructClient = () => {
  const baseUrl = constructBaseUrl();
  const baseApiParams = constructBaseApiParams();

  return new Brain({
  baseUrl,
  baseApiParams,
  customFetch: (url, options) => {
    return fetch(url, options);
  },
});

const brain = constructClient();

export default brain;
