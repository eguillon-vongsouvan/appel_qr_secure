"""Exemple : simulation d'un scan élève (à lancer avec le venv activé)."""

import argparse
import json
import sys

import httpx


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="http://127.0.0.1:8765", help="URL du serveur")
    p.add_argument("--token", required=True, help="Contenu texte du QR")
    p.add_argument("--student", default="eleve.demo")
    p.add_argument("--lat", type=float, default=48.8566)
    p.add_argument("--lon", type=float, default=2.3522)
    a = p.parse_args()
    r = httpx.post(
        f"{a.base.rstrip('/')}/api/attendance/scan",
        json={
            "token": a.token,
            "student_id": a.student,
            "latitude": a.lat,
            "longitude": a.lon,
        },
        timeout=30.0,
    )
    print(r.status_code, json.dumps(r.json(), indent=2, ensure_ascii=False))
    sys.exit(0 if r.is_success else 1)


if __name__ == "__main__":
    main()
