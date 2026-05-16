import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  portion: string;
}

export interface ScanResult {
  foodItems: Omit<FoodItem, 'id'>[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  coachFeedback: string;
}

export async function analyzeFoodImageAndText(
  base64Image: string | null, 
  mimeType: string | null, 
  textPrompt?: string,
  userContext?: {
    dailyGoals: { calories: number; protein: number; carbs: number; fats: number };
    currentTotals: { calories: number; protein: number; carbs: number; fats: number };
    goal: string;
  }
): Promise<ScanResult> {
  const parts: any[] = [];
  
  if (base64Image && mimeType) {
    parts.push({
      inlineData: {
        data: base64Image,
        mimeType: mimeType,
      },
    });
  }
  
  if (textPrompt) {
    parts.push({ text: textPrompt });
  }

  if (parts.length === 0) {
    throw new Error("Provide an image or text to analyze food.");
  }

  let contextString = "";
  if (userContext) {
    contextString = `
Current User Context:
- Fitness Goal: ${userContext.goal}
- Daily Targets: ${userContext.dailyGoals.calories} kcal, ${userContext.dailyGoals.protein}g protein, ${userContext.dailyGoals.carbs}g carbs, ${userContext.dailyGoals.fats}g fats.
- Eaten So Far Today (before this meal): ${userContext.currentTotals.calories} kcal, ${userContext.currentTotals.protein}g protein, ${userContext.currentTotals.carbs}g carbs, ${userContext.currentTotals.fats}g fats.
`;
  }

  const prompt = `
You are an expert, supportive AI nutrition coach. I need you to analyze the provided food image and/or text description.
Identify the food items, estimate their calories, macronutrients (protein, carbs, fats in grams), and portion size.

${contextString}

Based on the food detected AND the user's daily targets and fitness goal, provide smart, actionable nutrition coach feedback. Compare this meal with their daily targets. 
Identify excess calories or unhealthy foods if applicable, suggest healthier alternatives, and explain what should be reduced from the plate to support the user's goal. Try to be encouraging but direct about portion control and nutritional balance.

Return the data STRICTLY in JSON according to the schema provided.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [ { text: prompt }, ...parts ] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            foodItems: {
              type: Type.ARRAY,
              description: "List of detected food items on the plate or in the text.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Name of the food item" },
                  calories: { type: Type.INTEGER, description: "Estimated calories" },
                  protein: { type: Type.INTEGER, description: "Estimated protein in grams" },
                  carbs: { type: Type.INTEGER, description: "Estimated carbs in grams" },
                  fats: { type: Type.INTEGER, description: "Estimated fats in grams" },
                  portion: { type: Type.STRING, description: "Estimated portion size (e.g., '1 cup', '150g', '1 medium piece')" }
                },
                required: ["name", "calories", "protein", "carbs", "fats", "portion"]
              }
            },
            totals: {
              type: Type.OBJECT,
              description: "Total macro and calorie counts for the entire meal.",
              properties: {
                calories: { type: Type.INTEGER },
                protein: { type: Type.INTEGER },
                carbs: { type: Type.INTEGER },
                fats: { type: Type.INTEGER }
              },
              required: ["calories", "protein", "carbs", "fats"]
            },
            coachFeedback: {
              type: Type.STRING,
              description: "1-3 sentences of personalized, encouraging, and constructive feedback on this meal from an expert nutrition coach."
            }
          },
          required: ["foodItems", "totals", "coachFeedback"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    return JSON.parse(text) as ScanResult;
  } catch (err: any) {
    console.error("AI Analysis Error:", err);
    throw new Error("Failed to analyze food. Please try again.");
  }
}
