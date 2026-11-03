"""XP, levels, stars, streaks, badges, and target progression."""
from datetime import date, timedelta

XP_PER_LEVEL = 500

BADGES = {
    "first_session": "Finished your first session",
    "streak_3": "Three days in a row",
    "streak_7": "A full week of practice",
    "perfect_set": "Every rep scored 85 or more",
    "new_best": "Reached your highest range so far",
    "ten_sessions": "Ten sessions done",
}


def level_for(xp):
    return xp // XP_PER_LEVEL + 1


def stars_for(avg_score):
    if avg_score >= 85:
        return 3
    if avg_score >= 65:
        return 2
    return 1


def xp_for(rep_scores):
    return int(round(sum(s / 10 for s in rep_scores))) + 20  # +20 for finishing


def update_streak(g, today: date):
    """g: gamification row dict. Returns updated dict. One freeze per week forgives a missed day."""
    last = date.fromisoformat(g["last_day"]) if g["last_day"] else None
    if last == today:
        return g
    if last == today - timedelta(days=1):
        g["streak"] += 1
    elif last == today - timedelta(days=2) and g["freezes"] > 0:
        g["streak"] += 1
        g["freezes"] -= 1
    else:
        g["streak"] = 1
    if today.weekday() == 0:  # new week, freeze back
        g["freezes"] = 1
    g["longest_streak"] = max(g["longest_streak"], g["streak"])
    g["last_day"] = today.isoformat()
    return g


def next_target(plan, recent):
    """recent: last up-to-3 sessions for this exercise (dicts with avg_score, best_rom, pain).

    Returns (new_target, reason) — reason is None when nothing changes.
    """
    if not plan["auto_progress"] or len(recent) < 3:
        return plan["target_rom"], None
    avg_score = sum(s["avg_score"] or 0 for s in recent) / len(recent)
    avg_rom = sum(s["best_rom"] or 0 for s in recent) / len(recent)
    worst_pain = max((s["pain"] or 0) for s in recent)
    target = plan["target_rom"]
    if worst_pain >= 6 or avg_score < 55:
        new = max(20.0, target - 5)
        return new, "lowered"
    if avg_rom >= 0.9 * target and avg_score >= 75:
        new = min(plan["max_rom"], target + 5)
        if new > target:
            return new, "raised"
    return target, None
