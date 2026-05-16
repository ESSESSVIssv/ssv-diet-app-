export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'heavy_active' | 'athlete';
export type Goal = 'lose' | 'maintain' | 'gain';

export interface UserProfile {
  gender: Gender;
  age: number;
  height: number;
  weight: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export function calculateGoals(profile: UserProfile) {
  // STEP 1 — Calculate BMR (Mifflin-St Jeor Formula)
  let bmr = 0;
  if (profile.gender === 'male') {
    bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age) + 5;
  } else {
    bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age) - 161;
  }

  // STEP 2 — Calculate TDEE
  const activityMultipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,      // Light Exercise
    moderately_active: 1.55,    // Moderate Exercise
    heavy_active: 1.725,        // Heavy Exercise
    athlete: 1.9,               // Athlete
  };
  
  let tdee = bmr * activityMultipliers[profile.activityLevel];
  
  // STEP 3 — Set Goal Calories
  let targetCalories = tdee;
  if (profile.goal === 'lose') {
    targetCalories = tdee - 400; // Fat Loss: TDEE - 300 to 500 (using 400)
  } else if (profile.goal === 'gain') {
    targetCalories = tdee + 250; // Muscle Gain: TDEE + 200 to 300 (using 250)
  }
  // Maintain Weight is just TDEE

  // STEP 4 — Macronutrient Formula
  
  // Protein (weight_kg × 1.6 to 2.2)
  let proteinMultiplier = 1.9; // Base
  if (profile.goal === 'lose') proteinMultiplier = 2.2;
  else if (profile.goal === 'gain') proteinMultiplier = 2.0;
  
  const protein_g = Math.round(profile.weight * proteinMultiplier);
  
  // Fat (weight_kg × 0.6 to 0.9)
  const fatMultiplier = 0.8;
  const fat_g = Math.round(profile.weight * fatMultiplier);
  
  // Carbs (CalorieGoal - ((Protein_g × 4) + (Fat_g × 9))) / 4
  const carbs_g = Math.max(0, Math.round((targetCalories - ((protein_g * 4) + (fat_g * 9))) / 4));

  return {
    calories: Math.round(targetCalories),
    protein: protein_g,
    fats: fat_g,
    carbs: carbs_g,
    waterIntakeInt: Math.max(8, Math.round(profile.weight * 0.033 * 4)) // Roughly 33ml per kg
  };
}
