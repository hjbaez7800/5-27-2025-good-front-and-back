import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import brain from "brain"; // Import brain client
import { 
    CastleVerdeIndexResponse, 
    MacroNutrients, 
    CalculationRequest // Import request type
} from "types"; 
import { toast } from "sonner"; // Import toast for error handling

// Define the structure for a single item in the cart

// Define the structure for a single item in the cart
export interface CartItem extends MacroNutrients {
  id: string; // Unique ID for the cart item (e.g., timestamp or uuid)
  itemName: string;
  // Include the base nutritional data
  protein: number;
  fat: number;
  total_carbs: number;
  fiber: number;
  sugar: number;
  // Add quantity if items can be multiples, otherwise assume 1
  quantity: number; 
}

// Define the structure for the calculated totals and index for the whole cart
export interface CartTotals extends CastleVerdeIndexResponse {
  // Inherits predicted_spike, actual_macros, balanced_macros
  // Add any other cart-specific summary data if needed
  itemCount: number;
}

interface CartState {
  items: CartItem[];
  cartTotals: CartTotals | null;
  anchorKey: string; // Re-add anchorKey state
  error: string | null; // Added error state
  addItem: (itemData: Omit<CartItem, "id">) => void;
  removeItem: (itemId: string) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  calculateTotals: () => Promise<void>; 
  clearCart: () => void;
  setCartTotals: (totals: CartTotals | null) => void;
  setAnchorKey: (key: string) => void; // Re-add setAnchorKey action type
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      cartTotals: null,
      anchorKey: "protein", // Initialize default anchorKey
      error: null, // Initialize error state

      addItem: (itemData) => {
        const newItem: CartItem = {
          ...itemData,
          id: Date.now().toString(), // Simple unique ID for now
        };
        set((state) => ({ items: [...state.items, newItem] }));
        get().calculateTotals();
      },

      removeItem: (itemId) => {
        set((state) => ({ items: state.items.filter((item) => item.id !== itemId) }));
        if (get().items.length > 0) {
             get().calculateTotals();
        } else {
            set({ cartTotals: null }); 
        }
      },

      updateItemQuantity: (itemId, quantity) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, quantity: Math.max(0, quantity) } : item 
          ),
        }));
        get().calculateTotals(); // Recalculate after quantity update
      },
      
      setAnchorKey: (key) => {
        console.log("Setting anchor key:", key);
        set({ anchorKey: key }); // Update state
        get().calculateTotals(); // Recalculate totals with new anchor
      },
      
      // Function to calculate and set totals using the backend API
      calculateTotals: async () => {
        set({ error: null }); // Clear previous error on new calculation attempt
        const items = get().items;
        if (items.length === 0) {
          set({ cartTotals: null });
          return;
        }

        console.log("Aggregating items:", JSON.stringify(items, null, 2)); // Log items being aggregated

        // Aggregate nutritional data from all items
        const aggregated: Omit<MacroNutrients, 'net_carbs'> = items.reduce(
          (acc, item) => {
            const quantity = item.quantity || 1; // Default to 1 if quantity is missing/falsy
            acc.protein += (item.macros?.protein || 0) * quantity;
            acc.fat += (item.macros?.fat || 0) * quantity;
            acc.total_carbs += (item.macros?.total_carbs || 0) * quantity;
            acc.fiber += (item.macros?.fiber || 0) * quantity;
            acc.sugar += (item.macros?.sugar || 0) * quantity;
            return acc;
          },
          { protein: 0, fat: 0, total_carbs: 0, fiber: 0, sugar: 0 }
        );

        console.log("Calculated aggregated macros:", aggregated); // Log the result of aggregation

        // Prepare request body for the API - use anchor key from state
        const requestBody: CalculationRequest = {
            aggregated_input_data: aggregated, // Renamed from aggregated_macros
            anchor_id: get().anchorKey // Renamed from anchor_key
        };

        try {
            console.log("Calling calculate_castle_verde_index with:", requestBody);
            // Call the backend API endpoint using brain
            const response = await brain.calculate_castle_verde_index(requestBody);
            const result: CastleVerdeIndexResponse = await response.json();

            console.log("API Response:", result);

            // Add itemCount to the result before setting state
            const totalsWithCount: CartTotals = {
                ...result,
                itemCount: items.length,
            };

            set({ cartTotals: totalsWithCount });
            console.log("Updated cartTotals state:", get().cartTotals);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error calculating totals";
            console.error("Failed to calculate cart totals:", error);
            toast.error(`Error calculating cart totals: ${errorMessage}`);
            // Keep stale cartTotals data, but set the error state
            set({ error: errorMessage }); 
        }
      },

      clearCart: () => {
        set({ items: [], cartTotals: null });
      },

      setCartTotals: (totals) => {
          set({ cartTotals: totals });
      },
    }),
    {
      name: "cart-storage", // Unique name for localStorage key
      storage: createJSONStorage(() => localStorage), // Use localStorage
    }
  )
);
