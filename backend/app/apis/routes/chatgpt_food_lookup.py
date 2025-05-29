from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()

class FoodRequest(BaseModel):
    item: str

@router.post("/chatgpt-food-lookup")
async def chatgpt_food_lookup(request: Request, payload: FoodRequest):
    item = payload.item
    # TEMP: Return dummy data for now
    return {
        "protein": 25,
        "fat": 10,
        "fiber": 5,
        "carbs": 60,
        "sugar": 20,
    }
