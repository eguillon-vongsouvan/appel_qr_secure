"""Calcul de distance GPS (haversine) pour le périmètre école."""

from math import asin, cos, radians, sin, sqrt


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance entre deux points WGS84 en mètres."""
    r = 6371000.0
    p1, p2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlmb = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(p1) * cos(p2) * sin(dlmb / 2) ** 2
    return 2 * r * asin(sqrt(a))


def inside_geofence(
    lat: float,
    lon: float,
    school_lat: float,
    school_lon: float,
    radius_m: float,
) -> bool:
    return haversine_m(lat, lon, school_lat, school_lon) <= radius_m
