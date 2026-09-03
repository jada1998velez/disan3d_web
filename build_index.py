#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_index.py — DISAN3D Web (tienda pública)

Genera `data/products.json` (índice agregado que lee la tienda en runtime)
a partir de las carpetas `data/products/<id>/product.json`.

Uso:
    python3 build_index.py                 # escribe data/products.json
    python3 build_index.py --check         # valida y no escribe (código de salida != 0 si hay errores)

La "fuente de verdad" es cada `product.json`. Este índice es un artefacto
generado y se COMMITEA para que la tienda (hosting estático) funcione sin
procesos en el servidor.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
PRODUCTS_SRC = os.path.join(DATA, "products")
PRODUCTS_INDEX = os.path.join(DATA, "products.json")

# Campos que se conservan tal cual en el índice
KEEP = [
    "id", "name", "tagline", "description", "price", "currency",
    "customizable", "bestseller", "colors", "dimensions", "material",
    "printTime", "categories", "images", "available", "seo",
]


def load_json(path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def write_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.replace(tmp, path)


def normalize_product(folder, errors):
    meta_path = os.path.join(PRODUCTS_SRC, folder, "product.json")
    if not os.path.isfile(meta_path):
        errors.append("Falta product.json en la carpeta %r" % folder)
        return None
    try:
        raw = load_json(meta_path)
    except Exception as exc:  # noqa: BLE001
        errors.append("product.json %r no es JSON válido: %s" % (folder, exc))
        return None

    if not isinstance(raw, dict):
        errors.append("product.json %r debe ser un objeto" % folder)
        return None

    pid = raw.get("id") or folder
    out = {k: raw.get(k) for k in KEEP}
    # valores por defecto seguros
    out.setdefault("id", pid)
    out.setdefault("name", raw.get("name") or pid)
    out.setdefault("price", 0)
    out.setdefault("customizable", False)
    out.setdefault("bestseller", False)
    out.setdefault("categories", [])
    out.setdefault("images", [])
    out.setdefault("available", True)
    out.setdefault("seo", {})
    for k in ("tagline", "description", "currency", "colors", "dimensions", "material", "printTime"):
        out.setdefault(k, "" if k != "colors" else [])
    if out["id"] != folder:
        errors.append("El id %r no coincide con la carpeta %r" % (out["id"], folder))
    if not out["name"]:
        errors.append("El producto %r no tiene nombre" % pid)
    if not isinstance(out["price"], (int, float)) or out["price"] < 0:
        errors.append("El producto %r tiene un precio no válido: %r" % (pid, raw.get("price")))
    if not isinstance(out["categories"], list):
        errors.append("El producto %r: categories debe ser una lista" % pid)
    if not isinstance(out["images"], list):
        errors.append("El producto %r: images debe ser una lista" % pid)
    return out


def build(check=False):
    errors = []
    if not os.path.isdir(PRODUCTS_SRC):
        errors.append("No existe la carpeta %r" % PRODUCTS_SRC)
    products = []
    seen = set()
    if os.path.isdir(PRODUCTS_SRC):
        folders = sorted(
            d for d in os.listdir(PRODUCTS_SRC)
            if os.path.isdir(os.path.join(PRODUCTS_SRC, d)) and not d.startswith(".")
        )
        for folder in folders:
            prod = normalize_product(folder, errors)
            if prod is None:
                continue
            if prod["id"] in seen:
                errors.append("ID de producto duplicado: %r" % prod["id"])
                continue
            seen.add(prod["id"])
            products.append(prod)
    # orden estable: por order (si existe) y después por id
    products.sort(key=lambda p: (p.get("order", 1 << 30), p["id"]))
    if errors and check:
        for e in errors:
            print("ERROR:", e)
        return 1
    if errors:
        for e in errors:
            print("AVISO:", e)
    if check:
        print("OK · %d productos" % len(products))
        return 0
    write_json(PRODUCTS_INDEX, products)
    print("OK · data/products.json actualizado con %d productos" % len(products))
    return 0


if __name__ == "__main__":
    check = "--check" in sys.argv
    sys.exit(build(check=check))
