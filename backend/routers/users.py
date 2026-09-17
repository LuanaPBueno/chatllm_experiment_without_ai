from __future__ import annotations

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.auth import get_current_user

router = APIRouter(prefix="/api/user", tags=["user"])

class CustomInstructionsUpdate(BaseModel):
    custom_instructions: str | None = None

class CustomInstructionsResponse(BaseModel):
    custom_instructions: str | None = None

@router.get("/instructions", response_model=CustomInstructionsResponse)
def get_custom_instructions(current_user: User = Depends(get_current_user)):
    return {"custom_instructions": current_user.custom_instructions}

@router.put("/instructions", response_model=CustomInstructionsResponse)
def update_custom_instructions(
    payload: CustomInstructionsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.custom_instructions = payload.custom_instructions
    db.commit()
    db.refresh(current_user)
    return {"custom_instructions": current_user.custom_instructions}

