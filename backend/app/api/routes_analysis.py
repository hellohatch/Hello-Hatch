from fastapi import APIRouter
from app.services.scoring_engine import (
    calculate_lsi,
    calculate_lli,
    calculate_cei,
    calculate_leadership_risk
)

router = APIRouter()


@router.post("/analysis/run")
def run_analysis():
    responses = [4,5,4,3,5]
    load_scores = [3,3,4,4,3]
    exposure_scores = [2,3,2,3,2]

    lsi = calculate_lsi(responses)
    lli = calculate_lli(load_scores)
    cei = calculate_cei(exposure_scores)

    risk = calculate_leadership_risk(lsi, lli, cei)

    return {
        "LeadershipSignalIndex": lsi,
        "LeadershipLoadIndex": lli,
        "ConcentrationExposureIndex": cei,
        "LeadershipRiskScore": risk
    }
