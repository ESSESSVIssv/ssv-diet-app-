export interface DailyLog {
  date: string; // YYYY-MM-DD
  waterIntake: number; // in cups or ml. Let's use glasses/cups (e.g. 8 target)
  weight: number | null; 
  foodItems: import('./services/geminiService').FoodItem[];
  coachFeedbacks?: { id: string, text: string, date: string }[];
}

export interface UserGoals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  waterIntakeInt: number; // target (e.g. 8 glasses)
}

export const defaultGoals: UserGoals = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fats: 65,
  waterIntakeInt: 8
};
