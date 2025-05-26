import React, { useState, useRef, useCallback, useEffect } from "react";
import { Header } from "components/Header";
import { NutritionForm } from "components/NutritionForm";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCartStore } from "utils/cartStore";
import { shallow } from "zustand/shallow";
import { Camera, AlertCircle, Mic, Sparkles } from 'lucide-react'; // Import Mic and Sparkles icons
import { toast } from "sonner";
import { CastleVerdeIndexDisplay } from "components/CastleVerdeIndexDisplay";
import { CastleVerdeIndexGauge } from 'components/CastleVerdeIndexGauge';
import { Macro5Visualization } from "components/Macro5Visualization";
import brain from "brain";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CastleVerdeIndexResponse,
  MacroNutrients as BackendMacroNutrients,
  NutritionData, // Reusing this type for form data
  ExtractedMacrosResponse, // Updated to match backend/types.ts
  // CartItem, // This is defined in cartStore, can remove import here if not used directly
} from "types";

// Crop Zone Constants (as percentages of video dimensions)
const CROP_ZONE_X_PERCENT = 0.1; // 10% from the left
const CROP_ZONE_Y_PERCENT = 0.3; // 30% from the top
const CROP_ZONE_WIDTH_PERCENT = 0.8; // 80% width
const CROP_ZONE_HEIGHT_PERCENT = 0.4; // 40% height


// Define Anchor Options (assuming these remain the same)
const anchorOptions = [
  { value: "protein", label: "Protein" },
  { value: "fat", label: "Fat" },
  { value: "fiber", label: "Fiber" },
  { value: "sugar", label: "Sugar" },
  { value: "TotalCarbs", label: "Total Carbohydrates" },
];

// Define the color zones (assuming these remain the same)
const zones = [
  { label: "Low", range: [0, 14.9], color: "#28a745" },
  { label: "Caution", range: [15, 24.9], color: "#d3a00f" },
  { label: "Dangerous", range: [25, 34.9], color: "#d98c00" },
  { label: "Red Zone", range: [35, 50], color: "#c0392b" },
];

// Helper function to get Tailwind class for card background tint (assuming this remains the same)
const getCardBackgroundClass = (score: number | null): string => {
  if (score === null) return "bg-gray-50";
  const zone = zones.find(({ range }) => score >= range[0] && score <= range[1]);
  switch (zone?.label) {
    case "Low": return "bg-[#f5fef6]";
    case "Caution": return "bg-[#fffdf5]";
    case "Dangerous": return "bg-[#fff5f5]";
    case "Red Zone": return "bg-[#fff5f5]";
    default: return "bg-gray-50";
  }
};

// Type for the data extracted from OCR, including optional servings
interface OcrData extends Partial<NutritionData> {
  servings?: number | null;
}

// Type for balanced macros, mirroring what Macro5Visualization expects
interface BalancedMacros {
  protein: number;
  fat: number;
  fiber: number;
  totalCarbs: number;
  sugar: number;
}

// // Crop Zone Constants (as percentages of video dimensions)\n// const CROP_ZONE_X_PERCENT = 0.1; // 10% from the left\n// const CROP_ZONE_Y_PERCENT = 0.3; // 30% from the top\n// const CROP_ZONE_WIDTH_PERCENT = 0.8; // 80% width\n// const CROP_ZONE_HEIGHT_PERCENT = 0.4; // 40% height\n\n// Helper to map UI anchor key values to API expected values
const mapAnchorKeyToApiValue = (uiAnchorKey: string): string => {
  if (uiAnchorKey === "TotalCarbs") {
    return "total_carbs";
  }
  // Assuming other keys like "protein", "fat", "fiber", "sugar" are direct matches
  // or already in the correct snake_case format expected by the API enum.
  return uiAnchorKey.toLowerCase(); // General case to ensure lowercase if not already
};

export default function App() {
  // Cart state from Zustand store
  const {
    items,
    addItem: addItemToCart,
    removeItem,
    cartTotals,
    clearCart,
    anchorKey,
    setAnchorKey,
    error: cartError
  } = useCartStore();

  // State for Form and API interaction (add-to-cart process)
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // State for Individual Item Calculation/Gauge
  const [individualItemScore, setIndividualItemScore] = useState<number | null>(null);
  const [isCalculatingItem, setIsCalculatingItem] = useState(false); // Used by both add and autofill analysis
  const [calculationItemError, setCalculationItemError] = useState<string | null>(null);

  // State for AI Food Lookup (NEW)
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // State for Voice Recognition
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const isSpeechSupported = Boolean(SpeechRecognition);

  // State for Clear Cart confirmation dialog
  const [isClearCartConfirmOpen, setIsClearCartConfirmOpen] = useState(false);

  // State for Camera Modal
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraInitializing, setIsCameraInitializing] = useState(false);

  // State for OCR processing
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrResultData, setOcrResultData] = useState<OcrData | null>(null); // Used by both OCR and AI lookup

  // State for individual item's balanced macros for display
  const [individualBalancedMacros, setIndividualBalancedMacros] = useState<BalancedMacros | null>(null);
  const [isFetchingIndividualBalance, setIsFetchingIndividualBalance] = useState(false);

  // State for the anchor key of the single item graph
  const [singleItemAnchorKey, setSingleItemAnchorKey] = useState<string>(anchorOptions[0].value); // Default to first option

  // Define static styles for cart analysis card
  const cartCardStyle = "bg-white border border-gray-200"; // Static style for the combined card


  // --- Camera Access Effect --- (Keep as is)
  useEffect(() => {
    console.log("App.tsx: useEffect[isCameraModalOpen] triggered. Value:", isCameraModalOpen);
    let currentStream: MediaStream | null = null;

    const startCamera = async () => {
      console.log("App.tsx: startCamera called");
      setCameraError(null);
      setIsCameraInitializing(true);
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    console.log("Attempting to get camera with constraints:", { video: { facingMode: { ideal: 'environment' } } });
          currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
          setStream(currentStream);
          if (videoRef.current) {
            videoRef.current.srcObject = currentStream;
            // Ensure video plays, might need to be muted or user interaction first
            await videoRef.current.play().catch(playError => {
              console.warn("App.tsx: Video play() was prevented, possibly due to autoplay policy:", playError);
              // You might want to set a state here to show a "Click to play" button if needed
            });
            console.log("App.tsx: Camera stream started and attached to video element.");
            setIsCameraInitializing(false);
          } else {
            console.error("App.tsx: videoRef.current is null in startCamera");
            setCameraError("Video element not ready. Please try again.");
          }
        } else {
          console.error("App.tsx: navigator.mediaDevices.getUserMedia is not supported");
          setCameraError("Camera access is not supported by your browser.");
        }
      } catch (err: any) {
        setIsCameraInitializing(false);
        console.error("App.tsx: Error starting camera:", err);
        let errorMsg = "Failed to access camera.";
        if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          errorMsg = "No camera found. Please ensure a camera is connected and enabled.";
        } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          errorMsg = "Camera permission denied. Please enable camera access in your browser settings.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          errorMsg = "Camera is already in use or cannot be read. Close other apps using the camera.";
        }
        setCameraError(errorMsg);
        toast.error(errorMsg);
        // Stop any potentially lingering stream
        if (currentStream) {
          currentStream.getTracks().forEach(track => track.stop());
        }
        setStream(null);
      }
    };

    const stopCamera = () => {
      console.log("App.tsx: stopCamera called");
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        console.log("App.tsx: Camera stream stopped.");
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
      // currentStream is a local var, setStream(null) is the important part for React state
    };

    if (isCameraModalOpen) {
        startCamera();
    } else {
        stopCamera();
    }
    return () => { stopCamera(); };
  }, [isCameraModalOpen]);

  // --- Helper function to convert data URL to Blob --- (Keep as is)
  const dataURLtoBlob = (dataURL: string): Blob => {
      const byteString = atob(dataURL.split(',')[1]);
      const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
      }
      return new Blob([ab], { type: mimeString });
  };


  // --- Process captured image with OCR --- (Keep as is)
  const processCapturedImage = async (imageDataUrl: string) => {
    console.log("App.tsx: processCapturedImage function started.");
    setIsProcessingOcr(true);
    setOcrError(null);
    setOcrResultData(null); // Clear previous OCR/Lookup data

    try {
      // ... (rest of OCR processing logic) ...
      console.log("App.tsx: Converting data URL to Blob...");
      const imageBlob = dataURLtoBlob(imageDataUrl);
      const fileName = `label_image_${Date.now()}.png`;
      const imageFile = new File([imageBlob], fileName, { type: 'image/png' });
      console.log("App.tsx: Image file created:", imageFile);

      console.log('App.tsx: Sending image to OCR endpoint...');
      const response = await brain.process_label({ image: imageFile });
      console.log("App.tsx: Received response from brain.process_label:", response);

      if (!response.ok) {
        // ... (error handling for OCR response) ...
        let errorDetail = `OCR request failed with status: ${response.status}`;
        try {
            const errorData = await response.json();
            console.error("App.tsx: Parsed error response JSON:", errorData);
            errorDetail = errorData.detail || JSON.stringify(errorData) || errorDetail;
        } catch (parseError) {
            console.error("App.tsx: Could not parse error response body:", parseError);
        }
        console.error("App.tsx: OCR response not OK. Status:", response.status, "Detail:", errorDetail);
        throw new Error(errorDetail);
      }

      let ocrData;
      try {
        ocrData = await response.json();
        console.log('App.tsx: Parsed OCR Success Response JSON:', ocrData);
      } catch (jsonError) {
        // ... (error handling for parsing success response) ...
         console.error("App.tsx: Failed to parse successful OCR response JSON:", jsonError);
        throw new Error("Received invalid JSON format from OCR endpoint.");
      }

      const mappedData: OcrData = {
        itemName: 'Scanned Item',
        protein: ocrData.protein?.toString() ?? '',
        fat: ocrData.total_fat?.toString() ?? '',
        totalCarbs: ocrData.total_carbohydrate?.toString() ?? '',
        fiber: ocrData.dietary_fiber?.toString() ?? '',
        sugar: ocrData.total_sugars?.toString() ?? '',
        servings: ocrData.servings ?? null,
      };
      console.log("App.tsx: Mapped OCR data for form (incl. servings):", mappedData);

      setOcrResultData(mappedData); // Set data to populate form
      console.log("App.tsx: Called setOcrResultData with mapped data.");
      toast.success('Label scanned successfully!');

    } catch (err: any) {
      // ... (generic error handling for OCR) ...
       console.error('App.tsx: >>> ERROR in processCapturedImage catch block:', err);
       let displayError = 'Failed to process the image due to an unexpected error.';
       if (err.message) {
           displayError = err.message;
       }
       setOcrError(displayError);
       console.log("App.tsx: Called setOcrError with:", displayError);
       toast.error(`OCR Error: ${displayError}`);

    } finally {
      setIsProcessingOcr(false);
      console.log("App.tsx: Set isProcessingOcr to false.");
      setCapturedImage(null);
      console.log("App.tsx: Cleared capturedImage state.");
      console.log("App.tsx: processCapturedImage finally block executed.");
    }
  };

  // --- Effect to process image when captured --- (Keep as is)
  useEffect(() => {
    if (capturedImage) {
      console.log("App.tsx: Captured image detected, calling processCapturedImage.");
      processCapturedImage(capturedImage);
    } else {
      console.log("App.tsx: No captured image detected in useEffect.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturedImage]);

  // --- Handle Image Capture --- (Keep as is)
  const handleCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current && stream) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Dimensions of the video stream
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // Calculate the source coordinates and dimensions for cropping from the video
        const sx = videoWidth * CROP_ZONE_X_PERCENT;
        const sy = videoHeight * CROP_ZONE_Y_PERCENT;
        const sWidth = videoWidth * CROP_ZONE_WIDTH_PERCENT;
        const sHeight = videoHeight * CROP_ZONE_HEIGHT_PERCENT;

        // Set canvas dimensions to the cropped size
        canvas.width = sWidth;
        canvas.height = sHeight;

        const context = canvas.getContext('2d');
        if (context) {
            // Draw the cropped portion of the video onto the canvas
            context.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
            const dataUrl = canvas.toDataURL('image/png');
            console.log("App.tsx: Image captured and CROPPED from video stream.");
            setCapturedImage(dataUrl);
            setIsCameraModalOpen(false); // Close modal after capture
        } else {
            console.error("App.tsx: Failed to get 2D context from canvas for cropping.");
            setCameraError("Failed to get image context. Please try again.");
            toast.error("Failed to capture image context.");
        }
    } else {
         console.error("App.tsx: Video, canvas, or stream not available for capture.");
         setCameraError("Camera components not ready. Please try opening the camera again.");
         toast.error("Camera components not ready.");
    }
  }, [stream, setIsCameraModalOpen, setCapturedImage, setCameraError, videoRef, canvasRef]);

  // --- Calculate Individual Item Score (Helper Function) --- (NEW or Extracted Logic)
  // This function takes nutrition data and calculates the score, updating the gauge state.
  // It does NOT add to cart.
  const calculateIndividualScore = async (nutritionInput: NutritionData, itemName: string = "Item") => {
      setIsCalculatingItem(true);
      setIndividualItemScore(null);
      setCalculationItemError(null);

      // Prepare data for API (use SINGLE item macros, default servings 1 for calc)
      const individualMacros = {
        protein: Number(nutritionInput.protein) || 0,
        fat: Number(nutritionInput.fat) || 0,
        total_carbs: Number(nutritionInput.totalCarbs) || 0,
        fiber: Number(nutritionInput.fiber) || 0,
        sugar: Number(nutritionInput.sugar) || 0,
        // Net carbs calculation is handled by the backend based on these
      };

      const apiRequestBody = {
        aggregated_input_data: individualMacros, // Renamed from aggregated_macros
        anchor_id: anchorKey, // Renamed from anchor_key
      };

      try {
          console.log(`Sending item "${itemName}" for INDIVIDUAL analysis:`, apiRequestBody);
          const response = await brain.calculate_castle_verde_index(apiRequestBody);

          // Improved response handling
          if (!response.ok) {
              let errorDetail = `Calculation failed with status: ${response.status}`;
               try {
                  const errorData = await response.json();
                   if (errorData?.detail) {
                       if (Array.isArray(errorData.detail)) {
                          errorDetail = errorData.detail.map((d: any) => `${d.loc?.join('.') || 'field'} - ${d.msg || 'error'}`).join('; ');
                       } else {
                          errorDetail = String(errorData.detail);
                       }
                   } else {
                       errorDetail = JSON.stringify(errorData);
                   }
               } catch (parseError) {
                   console.error("Could not parse error response body for individual score:", parseError);
               }
               console.error(`INDIVIDUAL Analysis Response NOT OK for "${itemName}":`, errorDetail);
              throw new Error(errorDetail); // Throw to be caught below
          }

          const resultData: CastleVerdeIndexResponse = await response.json();
          console.log(`INDIVIDUAL Analysis Response OK for "${itemName}":`, resultData);

          setIndividualItemScore(resultData.predicted_spike ?? null);
          toast.info(`Analyzed "${itemName}" - Score: ${resultData.predicted_spike?.toFixed(1) ?? 'N/A'}`);

      } catch (err: any) {
          console.error("Error during individual item calculation:", err);
          const errorMessage = err.message || "An unexpected error occurred during calculation.";
          setCalculationItemError(errorMessage);
          toast.error(`Calculation Error: ${errorMessage}`);
          // Set score to null on error to clear gauge if needed
          setIndividualItemScore(null);
      } finally {
          setIsCalculatingItem(false);
      }
  };


  // --- Handler for Form Submission (Analyze INDIVIDUAL Item AND Add to Cart) --- (MODIFIED to use helper)
  const handleAnalyzeAndAddToCart = async (data: NutritionData) => {
    setIsSubmittingItem(true); // Still track submission separately
    setSubmissionError(null);
    // Reset individual item state before starting
    setIndividualItemScore(null);
    setCalculationItemError(null);

    const itemNameForDisplay = data.itemName || "Unnamed Item";
    const servings = (ocrResultData?.servings ?? 1) > 0 ? (ocrResultData?.servings ?? 1) : 1;

    // Prepare cart item data (MULTIPLIED by servings)
    const multipliedMacros = {
      protein: (Number(data.protein) || 0) * servings,
      fat: (Number(data.fat) || 0) * servings,
      total_carbs: (Number(data.totalCarbs) || 0) * servings,
      fiber: (Number(data.fiber) || 0) * servings,
      sugar: (Number(data.sugar) || 0) * servings,
      // Backend calculates net_carbs from these
    };

    const cartItem = {
      name: itemNameForDisplay,
      macros: multipliedMacros,
    };

    try {
        // New: Populate ocrResultData with manual form data so graph can display actuals
        // and balanced macros can be fetched.
        const formDataForOcrState: OcrData = {
          itemName: data.itemName || "Manually Added Item",
          protein: data.protein,
          fat: data.fat,
          totalCarbs: data.totalCarbs,
          fiber: data.fiber,
          sugar: data.sugar,
          // Attempt to get servings from form data if it exists (e.g. if NutritionForm passes it),
          // otherwise default to 1 for individual analysis display.
          // The `servings` used for cart addition is handled separately with `ocrResultData?.servings ?? 1`.
          servings: (data as any).servings ?? ocrResultData?.servings ?? 1,
        };
        setOcrResultData(formDataForOcrState);
        console.log("App.tsx: Set ocrResultData from manual form for graph display:", formDataForOcrState);

        // 1. Calculate the score for the individual item (using the helper)
        //    This now handles setting isCalculatingItem, score, error, and toasts for the gauge
        await calculateIndividualScore(data, itemNameForDisplay);

        // 2. Add item to cart store (runs even if individual calc failed, as per original logic)
        addItemToCart(cartItem);
        console.log("Item added to cart store:", cartItem);
        toast.success(`"${itemNameForDisplay}" added to cart!`);

        // 3. OCR/Lookup data is now cleared at the start of a new OCR/Lookup, not here.
        // setOcrResultData(null); // Removed this line

    } catch (err: any) {
        // Catch errors not handled within calculateIndividualScore (e.g., adding to cart fails?)
        // Though Zustand store errors are usually handled differently.
        console.error("Error during add-to-cart process (outside calc):", err);
        const errorMessage = err.message || "An unexpected error occurred adding item to cart.";
        setSubmissionError(errorMessage); // Set general submission error
        toast.error(`Submission Error: ${errorMessage}`);
    } finally {
        setIsSubmittingItem(false); // Only set this false here
    }
  };

  // --- Handler for AI Auto Fill Request --- (Integrated with Backend)
  const handleAutoFillRequest = async (itemName: string) => {
      if (!itemName.trim()) {
          toast.warning("Please enter an item name first.");
          return;
      }
      console.log(`handleAutoFillRequest triggered for item: "${itemName}"`);
      setIsLookingUp(true);
      setLookupError(null);
      setOcrResultData(null); // Clear previous OCR/lookup results
      setIndividualItemScore(null); // Clear individual calculation state
      setCalculationItemError(null);

      const toastId = toast.loading(`Looking up "${itemName}"...`);

      try {
          // --- Call Backend Endpoint ---
          console.log(`Calling brain.chatgpt_food_lookup with item: "${itemName}"`);
          // Import the specific response type for better type safety
          const response = await brain.chatgpt_food_lookup({ food_name: itemName });
          console.log("Received response from brain.chatgpt_food_lookup:", response);

          if (!response.ok) {
              let errorDetail = "AI lookup failed.";
              try {
                  const errorData = await response.json();
                  // Attempt to get detail from FastAPI's HTTPValidationError structure or a simple detail string
                  if (errorData?.detail) {
                      if (Array.isArray(errorData.detail)) {
                          errorDetail = errorData.detail.map((d: any) => `${d.loc?.join('.') || 'field'} - ${d.msg || 'error'}`).join('; ');
                      } else {
                          errorDetail = String(errorData.detail);
                      }
                  } else {
                     errorDetail = JSON.stringify(errorData);
                  }
              } catch (parseError) {
                  console.error("Could not parse error response body:", parseError);
                  errorDetail = `Lookup failed with status: ${response.status} ${response.statusText || ''}`;
              }
              console.error("Lookup response not OK:", errorDetail);
              throw new Error(errorDetail); // Throw to be caught by the outer catch block
          }

          // --- Process Successful Response ---
          const lookupData: ExtractedMacrosResponse = await response.json(); // Use the type from types.ts
          console.log("Parsed lookup response data:", lookupData);
          toast.success(`Lookup successful for "${itemName}"!`, { id: toastId });

          // Update form data using ocrResultData state
          const formDataFromLookup: OcrData = {
              itemName: itemName, // Keep the original item name
              protein: lookupData.protein?.toString() ?? '',
              fat: lookupData.fat?.toString() ?? '',
              totalCarbs: lookupData.total_carbs?.toString() ?? '', // Use total_carbs from response
              fiber: lookupData.fiber?.toString() ?? '', // Handle potential null/undefined fiber
              sugar: lookupData.sugar?.toString() ?? '',
              servings: 1 // Assume 1 serving for lookup
          };
          setOcrResultData(formDataFromLookup); // This triggers useEffect in NutritionForm

          // Trigger individual item analysis using the new data
          const nutritionDataForCalc: NutritionData = {
              itemName: formDataFromLookup.itemName,
              protein: formDataFromLookup.protein,
              fat: formDataFromLookup.fat,
              totalCarbs: formDataFromLookup.totalCarbs,
              fiber: formDataFromLookup.fiber,
              sugar: formDataFromLookup.sugar,
          }
          console.log("Triggering individual score calculation with AI data:", nutritionDataForCalc);
          await calculateIndividualScore(nutritionDataForCalc, itemName); // Use the helper

      } catch (err: any) {
          console.error("Error during AI food lookup:", err);
          const errorMessage = err.message || "An unexpected error occurred during lookup.";
          setLookupError(errorMessage);
          setCalculationItemError(errorMessage); // Also set calc error as analysis couldn't run
          toast.error(`Lookup Failed: ${errorMessage}`, { id: toastId });
      } finally {
          setIsLookingUp(false);
          console.log("handleAutoFillRequest finished.");
      }
  };


  // --- Handler for Voice Input --- (Keep as is, with simplified logging)
    const handleListen = () => {
        if (!isSpeechSupported) {
            console.warn("Speech recognition not supported in this browser.");
            setVoiceError("Speech recognition is not supported by your browser.");
            toast.warning("Voice input not supported.");
            return;
        }

        if (isListening) {
            // Stop listening
            recognitionRef.current?.stop();
            setIsListening(false);
            console.log("Stopped listening.");
        } else {
            // Start listening
            if (!recognitionRef.current) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false; // Listen for a single utterance
                recognitionRef.current.interimResults = false; // Only final results
                recognitionRef.current.lang = 'en-US'; // Set language

                recognitionRef.current.onresult = (event) => {
                    const currentTranscript = event.results[0][0].transcript;
                    console.log("Voice input result:", currentTranscript);
                    setTranscript(currentTranscript); // Display transcript
                    // Automatically trigger AI lookup with the transcript
                    if (currentTranscript.trim()) {
                         handleAutoFillRequest(currentTranscript.trim());
                    }
                    setIsListening(false); // Stop listening state after result
                };

                recognitionRef.current.onerror = (event) => {
                    console.error("Speech recognition error:", event.error);
                    let errorMsg = `Speech recognition error: ${event.error}`;
                    if (event.error === 'no-speech') {
                        errorMsg = "No speech detected. Please try again.";
                    } else if (event.error === 'audio-capture') {
                        errorMsg = "Audio capture failed. Ensure microphone is enabled.";
                    } else if (event.error === 'not-allowed') {
                        errorMsg = "Microphone access denied. Please grant permission.";
                    }
                    setVoiceError(errorMsg);
                    toast.error(errorMsg);
                    setIsListening(false);
                };

                recognitionRef.current.onend = () => {
                    console.log("Speech recognition ended.");
                    // Ensure listening state is false if stopped unexpectedly
                    if (isListening) {
                        setIsListening(false);
                    }
                };
            }

            setTranscript(""); // Clear previous transcript
            setVoiceError(null); // Clear previous errors
            recognitionRef.current.start();
            setIsListening(true);
            console.log("Started listening...");
            toast.info("Listening...");
        }
    };


  // Render the list of items currently in the cart (Keep as is)
    const renderCartItems = () => {
        if (items.length === 0) {
            return <p className="text-muted-foreground">Your cart is empty.</p>;
        }
        return (
            <ul className="space-y-2">
                {items.map((item) => (
                    <li key={item.id} className="flex justify-between items-center p-2 border rounded">
                        <span>{item.name}</span>
                        {/* Add details display or remove button here if needed */}
                         <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => removeItem(item.id)}
                        >
                            Remove
                        </Button>
                    </li>
                ))}
            </ul>
        );
    };

  // --- Debug Log --- (Keep as is)
  if (cartTotals) {
    console.log("Cart Totals Updated:", cartTotals);
    // console.log("Cart Error state:", cartError); // Can uncomment for debugging cart calc errors
  }

  // --- Effect to calculate balanced macros for individual display when OCR data or anchor changes ---
  useEffect(() => {
    const fetchIndividualBalancedMacros = async () => {
      if (ocrResultData && individualItemScore !== null && !isCalculatingItem && singleItemAnchorKey) {
        console.log("App.tsx: useEffect for individualBalancedMacros (API call) triggered. ocrResultData:", ocrResultData, "singleItemAnchorKey:", singleItemAnchorKey);
        setIsFetchingIndividualBalance(true);
        setIndividualBalancedMacros(null); // Clear previous balanced data

        const actualMacrosForApi = {
            protein: Number(ocrResultData.protein) || 0,
            fat: Number(ocrResultData.fat) || 0,
            total_carbs: Number(ocrResultData.totalCarbs) || 0,
            fiber: Number(ocrResultData.fiber) || 0,
            sugar: Number(ocrResultData.sugar) || 0,
        };
        
        const apiAnchor = mapAnchorKeyToApiValue(singleItemAnchorKey);

        const requestBody = {
            aggregated_input_data: actualMacrosForApi,
            anchor_id: apiAnchor,
        };

        try {
            console.log("Calling brain.calculate_castle_verde_index for single item balancing with body:", requestBody);
            const response = await brain.calculate_castle_verde_index(requestBody);

            if (!response.ok) {
                let errorDetail = `Balancing API request failed with status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || JSON.stringify(errorData) || errorDetail;
                } catch (parseError) { /* Do nothing, use status code */ }
                console.error("Single Item Balancing API Error:", errorDetail);
                toast.error(`Balancing Error: ${errorDetail}`);
                setIndividualBalancedMacros(null); // Ensure it's cleared on error
                return; // Exit early
            }

            const resultData: CastleVerdeIndexResponse = await response.json();
            console.log("Single Item Balancing API Success. Response data:", resultData);
            if (resultData.balanced_macros) {
                setIndividualBalancedMacros(resultData.balanced_macros);
            } else {
                console.warn("Balanced_macros not found in API response for single item.");
                setIndividualBalancedMacros(null);
            }

        } catch (err: any) {
            console.error("Error fetching individual balanced macros:", err);
            toast.error(`Balancing Error: ${err.message || "An unexpected error occurred."}`);
            setIndividualBalancedMacros(null);
        } finally {
            setIsFetchingIndividualBalance(false);
        }
      } else {
        // Conditions not met, clear balanced macros if they exist
        if (individualBalancedMacros !== null) {
            console.log("App.tsx: Clearing individualBalancedMacros because conditions for API call not met.");
            setIndividualBalancedMacros(null);
        }
      }
    };

    fetchIndividualBalancedMacros();
  // Dependencies: ocrResultData, individualItemScore, isCalculatingItem, singleItemAnchorKey
  }, [ocrResultData, individualItemScore, isCalculatingItem, singleItemAnchorKey]); // Removed individualBalancedMacros from deps to avoid loop, calculateBalancedMacrosForDisplay removed

  // --- JSX Structure ---
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow max-h-screen overflow-y-auto scroll-snap-type-y-mandatory md:max-h-full md:overflow-visible md:scroll-snap-type-none">
        <div className="container mx-auto px-4 md:grid md:grid-cols-2 md:gap-8">
          {/* Section 1: Add Item Form */}
          <div className="min-h-screen flex flex-col items-center justify-center p-4 scroll-snap-align-start md:min-h-0 md:flex-none md:items-stretch md:justify-start md:scroll-snap-align-none">
            <Card className="w-full max-w-md md:max-w-full shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Add Item</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={() => setIsCameraModalOpen(true)} title="Scan Nutrition Label" disabled={isProcessingOcr || isLookingUp || isSubmittingItem}>
                      <Camera className="h-4 w-4" />
                      <span className="sr-only">Scan Label</span>
                    </Button>
                    {isSpeechSupported && (
                      <Button
                        type="button"
                        onClick={handleListen}
                        variant={isListening ? "destructive" : "outline"}
                        size="icon" className="h-9 w-9"
                        title={isListening ? "Stop Listening" : "Start Voice Input"}
                        disabled={isProcessingOcr || isLookingUp || isSubmittingItem} // Disable during other operations
                      >
                        <Mic className="h-4 w-4" />
                        <span className="sr-only">{isListening ? "Stop Listening" : "Start Voice Input"}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Pass new props to NutritionForm */}
                <NutritionForm
                  onSubmit={handleAnalyzeAndAddToCart}
                  onAutoFill={handleAutoFillRequest} // <-- Pass handler
                  buttonLabel={isSubmittingItem ? "Adding..." : "Analyze & Add to Cart"}
                  initialData={ocrResultData}
                  isSubmitting={isSubmittingItem}
                  isLookingUp={isLookingUp} // <-- Pass lookup state
                />
                {/* Loading/Error states */}
                {isLookingUp && (
                  <div className="mt-4 flex items-center space-x-2 text-purple-600">
                    <Sparkles className="animate-pulse h-4 w-4" />
                    <p>Looking up nutrition data with AI...</p>
                  </div>
                )}
                 {lookupError && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>AI Lookup Error</AlertTitle>
                        <AlertDescription>{lookupError}</AlertDescription>
                    </Alert>
                )}
                {submissionError && ( <Alert variant="destructive" className="mt-4"> <AlertCircle className="h-4 w-4" /> <AlertTitle>Submission Error</AlertTitle> <AlertDescription>{submissionError}</AlertDescription> </Alert> )}
                {isProcessingOcr && ( <div className="mt-4 flex items-center space-x-2 text-blue-600"> <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div> <p>Scanning label...</p> </div> )}
                {ocrError && ( <Alert variant="destructive" className="mt-4"> <AlertCircle className="h-4 w-4" /> <AlertTitle>OCR Error</AlertTitle> <AlertDescription>{ocrError}</AlertDescription> </Alert> )}
                {voiceError && ( <Alert variant="destructive" className="mt-4"> <AlertCircle className="h-4 w-4" /> <AlertTitle>Voice Input Error</AlertTitle> <AlertDescription>{voiceError}</AlertDescription> </Alert> )}
                {transcript && ( <div className="mt-4 p-3 border rounded-md bg-muted/50"> <p className="text-sm text-muted-foreground">Heard: "{transcript}"</p> </div> )}
              </CardContent>
            </Card>
          </div>

          {/* Section 2: Individual Item Gauge */}
          {/* Show gauge if calculating, OR if score exists, OR if there's a calc error */}
          {(isCalculatingItem || individualItemScore !== null || calculationItemError) && (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 scroll-snap-align-start md:min-h-0 md:flex-none md:items-stretch md:justify-start md:scroll-snap-align-none">
              <Card className="w-full max-w-md md:max-w-full shadow-md border border-gray-200 bg-white">
                <CardHeader>
                  <CardTitle className="font-bold text-center text-2xl">Powered by the Castle Verde Index™</CardTitle>
                  <p className="text-sm text-muted-foreground text-center">Predictive glucose impact (single item)</p>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <CastleVerdeIndexGauge
                    score={individualItemScore}
                    isLoading={isCalculatingItem} // Use the combined loading state
                  />
                </CardContent>
                {/* Render Macro5 for individual item when data is available */}
                {ocrResultData && !isCalculatingItem && individualItemScore !== null && (
                  <CardContent className="pt-4 border-t">
                     <h4 className="text-sm font-semibold mb-2 text-center text-gray-600">Macronutrient Breakdown (Single Item)</h4>
                     {/* New Anchor Select for Single Item Graph */}
                     <div className="mb-4 w-full sm:w-1/2 md:w-2/3 mx-auto">
                        <Label htmlFor="single-item-anchor-select" className="mb-1 block text-xs font-medium text-gray-600">Balance Anchor:</Label>
                        <Select value={singleItemAnchorKey} onValueChange={setSingleItemAnchorKey}>
                            <SelectTrigger id="single-item-anchor-select" className="h-9 text-xs">
                                <SelectValue placeholder="Select Anchor" />
                            </SelectTrigger>
                            <SelectContent>
                                {anchorOptions // Display all anchor options now
                                    // .filter(option => VALID_ANCHOR_KEYS_FOR_DISPLAY.has(option.value)) // Temporarily removed filter to show all
                                    .map((option) => (
                                    <SelectItem key={option.value} value={option.value} className="text-xs">
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <Macro5Visualization
                        actualProtein={Number(ocrResultData.protein) || 0}
                        actualFat={Number(ocrResultData.fat) || 0}
                        actualFiber={Number(ocrResultData.fiber) || 0}
                        // Assuming Macro5Visualization expects net carbs, adjust if it expects total
                        // If it needs Total Carbs, use Number(ocrResultData.totalCarbs)
                        // Let's assume it needs Total Carbs for now based on component name
                        actualTotalCarbs={Number(ocrResultData.totalCarbs) || 0}
                        actualSugar={Number(ocrResultData.sugar) || 0}
                        // Balanced props might be placeholders or derived differently for single item
                        balancedProtein={individualBalancedMacros?.protein ?? 0} 
                        balancedFat={individualBalancedMacros?.fat ?? 0} 
                        balancedFiber={individualBalancedMacros?.fiber ?? 0} 
                        balancedTotalCarbs={individualBalancedMacros?.total_carbs ?? 0} // Corrected: Use snake_case from API response
                        balancedSugar={individualBalancedMacros?.sugar ?? 0} 
                        totalCalories={0} // Placeholder
                        anchorKey={singleItemAnchorKey} // Pass singleItemAnchorKey
                        itemName={ocrResultData.itemName || "Analyzed Item"}
                     />
                  </CardContent>
                )}
                <CardFooter className="flex flex-col items-center pt-4">
                   {calculationItemError && (
                    <Alert variant="destructive" className="w-full mt-2 mb-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Analysis Error</AlertTitle>
                      <AlertDescription>{calculationItemError}</AlertDescription>
                    </Alert>
                  )}
                   <p className="text-left text-sm text-muted-foreground px-2">
                    Note: This score is an estimate based on CGM data and the Castle Verde Index™ algorithm. It does not account for age, gender, BMI, fasting status, stomach contents, or post-meal activity.
                  </p>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* Section 3: Shopping Cart List */}
          <div className="min-h-screen flex flex-col items-center justify-center p-4 scroll-snap-align-start md:min-h-0 md:flex-none md:items-stretch md:justify-start md:scroll-snap-align-none">
            <Card className="w-full max-w-md md:max-w-full">
             {/* ... Cart rendering unchanged ... */}
             <CardHeader>
                <CardTitle>Shopping Cart</CardTitle>
                <div className="flex justify-end items-center space-x-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsClearCartConfirmOpen(true)}
                      disabled={items.length === 0}
                    >
                       Clear Cart
                    </Button>
                </div>
              </CardHeader>
              <CardContent>{renderCartItems()}</CardContent>
            </Card>
          </div>

          {/* Section 4: Combined Cart Analysis */}
          <div className="min-h-screen flex flex-col items-center justify-center p-4 scroll-snap-align-start md:min-h-0 md:flex-none md:items-stretch md:justify-start md:scroll-snap-align-none">
            {/* ... Combined cart analysis rendering unchanged ... */}
            {items.length > 0 && cartTotals && cartTotals.input_data ? (
              <Card className="w-full max-w-md md:max-w-full mb-24">
                 {/* ... Anchor select and visualization unchanged ... */}
                  <CardHeader>
                    <CardTitle>Combined Cart Analysis</CardTitle>
                     <div className="mt-4 w-full sm:w-1/2 md:w-1/3">
                        <Label htmlFor="anchor-select" className="mb-2 block text-sm font-medium text-gray-700">Balance Anchor:</Label>
                        <Select value={anchorKey} onValueChange={setAnchorKey}>
                            <SelectTrigger id="anchor-select">
                                <SelectValue placeholder="Select Anchor" />
                            </SelectTrigger>
                            <SelectContent>
                                {anchorOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {cartError && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Cart Calculation Error</AlertTitle>
                            <AlertDescription>{cartError}</AlertDescription>
                        </Alert>
                    )}
                    <Macro5Visualization
                        actualProtein={cartTotals.input_data.protein}
                        actualFat={cartTotals.input_data.fat}
                        actualFiber={cartTotals.input_data.fiber}
                        actualTotalCarbs={cartTotals.input_data.total_carbs}
                        actualSugar={cartTotals.input_data.sugar}
                        balancedProtein={cartTotals.balanced_macros.protein}
                        balancedFat={cartTotals.balanced_macros.fat}
                        balancedFiber={cartTotals.balanced_macros.fiber}
                        balancedTotalCarbs={cartTotals.balanced_macros.total_carbs}
                        balancedSugar={cartTotals.balanced_macros.sugar}
                        totalCalories={cartTotals.total_calories}
                        anchorKey={anchorKey}
                        itemName="Combined Cart"
                    />
                  </CardContent>
                  <CardFooter className="flex flex-col items-center pt-4">
                    <CastleVerdeIndexDisplay
                        score={cartTotals.predicted_spike}
                        tierLabel={cartTotals.tier_label}
                        tierColor={cartTotals.tier_color}
                        isLoading={false} // Assuming cart calculation is synchronous or handled by store
                    />
                    <p className="text-left text-sm text-muted-foreground px-2 mt-4">
                        Note: This score is an estimate based on CGM data and the Castle Verde Index™ algorithm. It does not account for age, gender, BMI, fasting status, stomach contents, or post-meal activity.
                    </p>
                  </CardFooter>
              </Card>
            ) : (
              <Card className="w-full max-w-md md:max-w-full">
                <CardHeader>
                  <CardTitle>Combined Cart Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Add items to the cart to see the combined analysis.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Camera Modal START */}
        <Dialog open={isCameraModalOpen} onOpenChange={setIsCameraModalOpen}>
          <DialogContent className="sm:max-w-[480px] md:max-w-[640px] lg:max-w-[720px] p-0 overflow-hidden flex flex-col max-h-[95vh]">
            <DialogHeader className="p-4 pb-2 border-b">
              <DialogTitle className="text-lg font-semibold">Scan Nutrition Label</DialogTitle>
            </DialogHeader>
            
            <div className="relative flex-grow w-full bg-black flex items-center justify-center overflow-hidden"> {/* Container for video and overlay */}
              {cameraError && (
                <Alert variant="destructive" className="absolute top-4 left-4 right-4 z-20 max-w-sm mx-auto shadow-lg">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Camera Error</AlertTitle>
                  <AlertDescription>{cameraError}</AlertDescription>
                </Alert>
              )}
              {isCameraInitializing && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 z-30">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-3"></div>
                    <p className="text-white text-base">Initializing Camera...</p>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline // Important for iOS
                muted // Often required for autoplay
                className={`w-full h-full object-contain block transition-opacity duration-300 ${isCameraInitializing ? 'opacity-0' : 'opacity-100'}`}
                onLoadedData={() => {
                  console.log("Video metadata loaded. Dimensions:", videoRef.current?.videoWidth, videoRef.current?.videoHeight);
                  // Potentially adjust something here if needed once video dimensions are known
                }}
                onCanPlay={() => {
                  console.log("Video can play for crop");
                  // setIsCameraInitializing(false); // Moved to startCamera success
                }}
              />
              {/* Crop Overlay */}
              {!isCameraInitializing && !cameraError && stream && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.98)`, 
                    clipPath: `polygon(
                      0% 0%, 0% 100%,
                      ${CROP_ZONE_X_PERCENT*100}% 100%,
                      ${CROP_ZONE_X_PERCENT*100}% ${CROP_ZONE_Y_PERCENT*100}%,
                      ${(CROP_ZONE_X_PERCENT + CROP_ZONE_WIDTH_PERCENT)*100}% ${CROP_ZONE_Y_PERCENT*100}%,
                      ${(CROP_ZONE_X_PERCENT + CROP_ZONE_WIDTH_PERCENT)*100}% ${(CROP_ZONE_Y_PERCENT + CROP_ZONE_HEIGHT_PERCENT)*100}%,
                      ${CROP_ZONE_X_PERCENT*100}% ${(CROP_ZONE_Y_PERCENT + CROP_ZONE_HEIGHT_PERCENT)*100}%,
                      ${CROP_ZONE_X_PERCENT*100}% 100%,
                      100% 100%, 100% 0%
                    )`
                  }}
                >
                   <div
                    className="absolute border-8 border-yellow-400"
                    style={{
                      top: `${CROP_ZONE_Y_PERCENT*100}%`,
                      left: `${CROP_ZONE_X_PERCENT*100}%`,
                      width: `${CROP_ZONE_WIDTH_PERCENT*100}%`,
                      height: `${CROP_ZONE_HEIGHT_PERCENT*100}%`,
                      boxSizing: 'border-box'
                    }}
                  ></div>
                  <p className="absolute text-white text-xs sm:text-sm font-medium bg-black bg-opacity-70 px-2 py-1 rounded shadow-md"
                     style={{
                        top: `calc(${CROP_ZONE_Y_PERCENT*100}% - 28px)`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        pointerEvents: 'none'
                     }}
                  >
                    Align nutrition label within the box
                  </p>
                </div>
              )}
            </div>
            {/* Hidden canvas for capturing the image */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            <DialogFooter className="p-3 border-t bg-gray-50 flex-col sm:flex-row sm:justify-between sm:items-center">
                <Button variant="outline" onClick={() => setIsCameraModalOpen(false)} className="w-full sm:w-auto mb-2 sm:mb-0 order-last sm:order-first">Cancel</Button>
                <Button
                  onClick={handleCapture}
                  disabled={!stream || !!cameraError || isCameraInitializing}
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                >
                  {isProcessingOcr ? 'Processing...' : 'Capture'}
                </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Camera Modal END */}

        {/* Clear Cart Confirmation Dialog */}
        <AlertDialog open={isClearCartConfirmOpen} onOpenChange={setIsClearCartConfirmOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action will permanently remove all items from your shopping cart.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => {
                            clearCart();
                            toast.info("Cart cleared.");
                            setIsClearCartConfirmOpen(false);
                        }}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        Clear Cart
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </main>
    </div>
  );
}
