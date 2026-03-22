import statistics


def calculate_lsi(responses):
    """
    Leadership Signal Index
    Measures leadership behavioral signals
    """
    return round(statistics.mean(responses) * 20, 2)


def calculate_lli(load_scores):
    """
    Leadership Load Index
    Measures decision demand on leader
    """
    return round(statistics.mean(load_scores) * 20, 2)


def calculate_cei(exposure_scores):
    """
    Concentration Exposure Index
    Measures decision concentration risk
    """
    return round(statistics.mean(exposure_scores) * 20, 2)


def calculate_leadership_risk(lsi, lli, cei):
    """
    Leadership Risk Score
    Combines system indicators
    """

    risk = ((100 - lsi) * 0.4 + lli * 0.35 + cei * 0.25)

    return round(risk, 2)
