"""
PulseDesk NLP Microservice
Sentiment analysis, vocabulary shift detection, and narrative generation.
"""

import os
import statistics
from typing import Optional
from datetime import datetime, timezone

import asyncpg
from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel

app = FastAPI(title="PulseDesk NLP Service", version="1.0.0")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://pulsedesk:pulsedesk_secret@localhost:5432/pulsedesk",
)


async def get_api_key():
    return os.getenv("NLP_SERVICE_API_KEY", "internal_service_key")


async def get_db_pool():
    if not hasattr(app.state, "pool") or app.state.pool is None:
        app.state.pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=5)
    return app.state.pool


async def verify_api_key(x_api_key: Optional[str] = Header(None)):
    api_key = await get_api_key()
    if x_api_key != api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key


# ─── Request Models ───

class SentimentRequest(BaseModel):
    teamId: str
    orgId: str
    windowStart: str


class VocabShiftRequest(BaseModel):
    teamId: str
    orgId: str
    windowStart: str
    baselineStart: str


class ReportRequest(BaseModel):
    teamId: str
    orgId: str
    compositeScore: float
    riskLevel: str
    scores: dict
    rawStats: dict
    consecutiveWeeksTriggered: int
    isSustained: bool


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str


# ─── Sentiment Analysis ───

def compute_sentiment_score(events: list) -> float:
    if not events:
        return 50.0

    sentiments = [e.get("sentiment_score") for e in events if e.get("sentiment_score") is not None]
    if sentiments:
        avg_sent = statistics.mean(sentiments)
        return round(min(100, max(0, 50 - avg_sent * 50)), 1)

    text_features = []
    for e in events:
        text_length = e.get("message_length", 0) or 0
        has_question = e.get("has_question", False) or False
        score = 0.5
        if text_length > 200:
            score -= 0.1
        elif text_length < 20:
            score -= 0.05
        if not has_question:
            score -= 0.05
        text_features.append(score)

    if not text_features:
        return 50.0
    avg = statistics.mean(text_features)
    return round(min(100, max(0, 50 - avg * 50)), 1)


# ─── Vocabulary Shift ───

def compute_vocab_shift(cur_events: list, base_events: list) -> float:
    if not cur_events or not base_events:
        return 50.0

    cur_count = len(cur_events)
    base_count = len(base_events)

    cur_lengths = [e.get("message_length", 0) or 0 for e in cur_events]
    base_lengths = [e.get("message_length", 0) or 0 for e in base_events]
    cur_avg_len = statistics.mean(cur_lengths) if cur_lengths else 0
    base_avg_len = statistics.mean(base_lengths) if base_lengths else 0

    cur_q_count = sum(1 for e in cur_events if e.get("has_question"))
    base_q_count = sum(1 for e in base_events if e.get("has_question"))
    cur_q_rate = cur_q_count / cur_count if cur_count > 0 else 0
    base_q_rate = base_q_count / base_count if base_count > 0 else 0

    cur_short = sum(1 for e in cur_events if (e.get("message_length") or 0) < 20)
    cur_short_rate = cur_short / cur_count if cur_count > 0 else 0

    len_ratio = (cur_avg_len / base_avg_len) if base_avg_len > 0 else 1
    q_ratio = (cur_q_rate / base_q_rate) if base_q_rate > 0 else 1

    score = (
        (1 - min(len_ratio, 1)) * 50 +
        (1 - min(q_ratio, 1)) * 30 +
        cur_short_rate * 20
    )

    return round(min(100, max(0, score)), 1)


# ─── Narrative Generation ───

def generate_narrative(data: ReportRequest) -> str:
    risk = data.riskLevel
    score = data.compositeScore

    narratives = {
        "low": (
            f"This team is showing healthy wellbeing indicators with a composite score of {score:.0f}/100. "
            "All biomarker metrics remain within normal ranges. Communication patterns are consistent, "
            "sentiment is positive, and after-hours activity is minimal."
        ),
        "moderate": (
            f"This team shows early signs of increased stress (composite score: {score:.0f}/100). "
            f"Sentiment scores are shifting "
            f"{'negatively' if data.scores.get('sentiment', 0) > 50 else 'slightly'}, "
            "and there are subtle changes in communication patterns. "
            "Consider a proactive wellbeing check-in with the team lead."
        ),
        "elevated": (
            f"This team has entered an elevated risk zone with a composite score of {score:.0f}/100. "
            f"{'After-hours communication has increased substantially. ' if data.rawStats.get('avgAfterHoursRatio', 0) > 0.3 else ''}"
            f"{'Response latency is drifting, suggesting cognitive overload. ' if data.scores.get('latency', 0) > 60 else ''}"
            f"{'Vocabulary patterns show signs of communication collapse. ' if data.scores.get('vocabShift', 0) > 60 else ''}"
            f"{'This pattern has persisted for multiple weeks. ' if data.isSustained else ''}"
            "Recommended: workload audit, team retrospective, and clear project scope."
        ),
        "high": (
            f"This team is at critical burnout risk with a composite score of {score:.0f}/100. "
            "Multiple biomarkers are in the danger zone simultaneously. "
            f"{'This is a sustained pattern. ' if data.isSustained else 'Immediate attention required. '}"
            "Recommended: mandatory time-off redistribution, "
            "sprint scope reduction by at least 30%, "
            "structured 1:1 support conversations, "
            "and escalation to executive leadership."
        ),
    }

    return narratives.get(risk, f"Team wellbeing composite score: {score:.0f}/100. Risk level: {risk}.")


def generate_recommendations(data: ReportRequest) -> list[str]:
    recs = []
    s = data.scores
    stats = data.rawStats

    if data.riskLevel in ("elevated", "high"):
        if s.get("sentiment", 0) > 60:
            recs.append("Schedule a team retrospective to address communication and morale concerns")
        if stats.get("avgAfterHoursRatio", 0) > 0.3:
            recs.append("Review workload distribution and establish boundaries on after-hours communication")
            recs.append("Implement a 'no messages after 6pm' team agreement")
        if s.get("latency", 0) > 60:
            recs.append("Evaluate current sprint commitments and consider reducing scope")
            recs.append("Introduce mandatory focus time blocks")
        if s.get("vocabShift", 0) > 60:
            recs.append("Conduct a communication health workshop focused on psychological safety")
        if data.isSustained:
            recs.append("Engage Employee Assistance Program (EAP) for facilitated team support")
            recs.append("Conduct structured 1:1 conversations using the PulseDesk conversation guide")
        recs.append("Reassess in 2 weeks to track intervention effectiveness")
    elif data.riskLevel == "moderate":
        recs.append("Proactive check-in with team lead about observed communication changes")
        recs.append("Review upcoming workload and identify potential stress points")
    else:
        recs.append("Continue current practices — team wellbeing indicators are healthy")
        recs.append("Schedule regular pulse checks to maintain awareness")

    return recs


def generate_key_factors(data: ReportRequest) -> list[str]:
    factors = []
    s = data.scores
    stats = data.rawStats

    if s.get("sentiment", 0) > 60:
        factors.append("Declining message sentiment polarity")
    if stats.get("avgAfterHoursRatio", 0) > 0.3:
        factors.append(f"Elevated after-hours activity ({stats['avgAfterHoursRatio']:.0%} of messages)")
    if s.get("latency", 0) > 60:
        factors.append("Response latency drift indicating cognitive load")
    if s.get("vocabShift", 0) > 60:
        factors.append("Vocabulary shift — reduced question-asking and message length")
    if data.isSustained:
        factors.append(f"Sustained risk pattern over {data.consecutiveWeeksTriggered} consecutive weeks")

    if not factors:
        factors.append("All biomarkers within normal ranges")

    return factors


# ─── API Endpoints ───

@app.on_event("startup")
async def startup():
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=5)
    app.state.pool = pool
    async with pool.acquire() as conn:
        await conn.execute("SELECT 1")


@app.on_event("shutdown")
async def shutdown():
    if hasattr(app.state, "pool") and app.state.pool:
        await app.state.pool.close()


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        service="pulsedesk-nlp",
        version="1.0.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/sentiment")
async def analyze_sentiment(
    req: SentimentRequest,
    api_key: str = Depends(verify_api_key),
):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT sentiment_score, message_length, has_question
            FROM biomarker_events
            WHERE team_id = $1 AND org_id = $2
              AND event_time >= $3
              AND event_type = 'message'
            """,
            req.teamId,
            req.orgId,
            req.windowStart,
        )

    events = [dict(r) for r in rows]
    score = compute_sentiment_score(events)
    return {"score": score, "events_analyzed": len(events)}


@app.post("/vocab-shift")
async def analyze_vocab_shift(
    req: VocabShiftRequest,
    api_key: str = Depends(verify_api_key),
):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        cur_rows = await conn.fetch(
            """
            SELECT message_length, has_question
            FROM biomarker_events
            WHERE team_id = $1 AND org_id = $2
              AND event_time >= $3
              AND event_type = 'message'
            """,
            req.teamId,
            req.orgId,
            req.windowStart,
        )
        base_rows = await conn.fetch(
            """
            SELECT message_length, has_question
            FROM biomarker_events
            WHERE team_id = $1 AND org_id = $2
              AND event_time >= $3 AND event_time < $4
              AND event_type = 'message'
            """,
            req.teamId,
            req.orgId,
            req.baselineStart,
            req.windowStart,
        )

    cur_events = [dict(r) for r in cur_rows]
    base_events = [dict(r) for r in base_rows]
    score = compute_vocab_shift(cur_events, base_events)
    return {"score": score, "cur_events": len(cur_events), "base_events": len(base_events)}


@app.post("/generate-report")
async def generate_report(
    req: ReportRequest,
    api_key: str = Depends(verify_api_key),
):
    narrative = generate_narrative(req)
    recommendations = generate_recommendations(req)
    key_factors = generate_key_factors(req)

    return {
        "narrative": narrative,
        "recommendations": recommendations,
        "key_factors": key_factors,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
