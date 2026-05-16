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
  let bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age);
  bmr += profile.gender === 'male' ? 5 : -161;

  // STEP 2 — Calculate TDEE
  const activityMultipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    heavy_active: 1.725,
    athlete: 1.9,
  };
  
  let tdee = bmr * activityMultipliers[profile.activityLevel];
  
  // STEP 3 — Set Goal Calories
  let targetCalories = tdee;
  if (profile.goal === 'lose') targetCalories -= 500;
  else if (profile.goal === 'gain') targetCalories += 300;

  // STEP 4 — Macronutrient Formula
  
  // Protein (1.6 to 2.2 g per kg)
  let proteinMultiplier = 1.8;
  if (profile.goal === 'lose') proteinMultiplier = 2.2; // higher protein for fat loss to preserve muscle
  else if (profile.goal === 'gain') proteinMultiplier = 2.0;
  
  const protein = Math.round(profile.weight * proteinMultiplier);
  
  // Fat (0.6 to 0.9 g per kg)
  const fatMultiplier = 0.8;
  const fats = Math.round(profile.weight * fatMultiplier);
  
  // Carbs (remaining calories)
  const carbs = Math.max(0, Math.round((targetCalories - ((protein * 4) + (fats * 9))) / 4));

  return {
    calories: Math.max(1200, Math.round(targetCalories)), // Enforce minimum 1200 kcal
    protein,
    fats,
    carbs,
    waterIntakeInt: Math.max(8, Math.round(profile.weight * 0.033 * 4)) // Roughly 33ml per kg
  };
}
