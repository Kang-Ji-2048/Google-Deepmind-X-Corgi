export const CUISINE_OPTIONS = ["Any cuisine", "British", "Italian", "Mexican", "Indian", "Japanese", "Chinese", "Thai", "Mediterranean"] as const;
export const COOKING_TIME_OPTIONS = ["Any time", "15 min", "30 min", "45 min", "60 min"] as const;

export type PhotoPreferences = {
  cuisine: typeof CUISINE_OPTIONS[number];
  cookingTime: typeof COOKING_TIME_OPTIONS[number];
  showRecipe: boolean;
};

type PhotoPreferencesAction =
  | { type: "cuisine"; value: PhotoPreferences["cuisine"] }
  | { type: "time"; value: PhotoPreferences["cookingTime"] }
  | { type: "photos-changed" | "done" | "edit" };

export const initialPhotoPreferences: PhotoPreferences = {
  cuisine: "Any cuisine",
  cookingTime: "Any time",
  showRecipe: false,
};

// Visual prototype only: preferences are retained locally, not sent to a model or search provider.
export function photoPreferencesReducer(state: PhotoPreferences, action: PhotoPreferencesAction): PhotoPreferences {
  switch (action.type) {
    case "cuisine": return { ...state, cuisine: action.value, showRecipe: false };
    case "time": return { ...state, cookingTime: action.value, showRecipe: false };
    case "done": return { ...state, showRecipe: true };
    case "photos-changed":
    case "edit": return { ...state, showRecipe: false };
  }
}
