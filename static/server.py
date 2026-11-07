"""Flask backend that connects the web UI (index.html + brain.js) to the ML model."""
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, send_from_directory
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler
from sklearn.svm import SVC

BASE = Path(__file__).resolve().parent
MODEL_PATH = BASE / "diabetes_model.joblib"
SEED = 2
THRESHOLD = 0.40  # below 0.5 on purpose: a missed diabetic is worse than a false alarm

# JSON key sent by brain.js -> column name in diabetes.csv (order matters)
FIELDS = [
    ("pregnancies", "Pregnancies"), ("glucose", "Glucose"),
    ("bloodPressure", "BloodPressure"), ("skinThickness", "SkinThickness"),
    ("insulin", "Insulin"), ("bmi", "BMI"),
    ("pedigree", "DiabetesPedigreeFunction"), ("age", "Age"),
]
# Same limits as the <input min/max> in index.html (the server must not trust the browser)
LIMITS = {
    "pregnancies": (0, 20), "glucose": (1, 300), "bloodPressure": (1, 200),
    "skinThickness": (0, 100), "insulin": (0, 900), "bmi": (1, 80),
    "pedigree": (0, 2.5), "age": (1, 120),
}
ZERO_IS_MISSING = [1, 2, 3, 4, 5]  # Glucose, BloodPressure, SkinThickness, Insulin, BMI


def zeros_to_nan(X):
    X = np.array(X, dtype=float)
    cols = X[:, ZERO_IS_MISSING]
    X[:, ZERO_IS_MISSING] = np.where(cols == 0, np.nan, cols)
    return X


def build_model():
    df = pd.read_csv(BASE / "diabetes.csv")
    X, y = df.drop(columns="Outcome"), df["Outcome"]
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=SEED)
    model = Pipeline([
        ("zeros", FunctionTransformer(zeros_to_nan)),
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
        ("svm", SVC(kernel="linear", probability=True, random_state=SEED)),
    ])
    model.fit(X_tr, y_tr)  # imputer/scaler fit on training data only
    print("Test accuracy:", round(accuracy_score(y_te, model.predict(X_te)), 3))
    joblib.dump(model, MODEL_PATH)
    return model


model = joblib.load(MODEL_PATH) if MODEL_PATH.exists() else build_model()


class BadInput(ValueError):
    pass


def to_row(record, where=""):
    if not isinstance(record, dict):
        raise BadInput(f"{where}expected an object with the eight fields.")
    row = []
    for key, label in FIELDS:
        if key not in record:
            raise BadInput(f"{where}missing field '{key}'.")
        v = record[key]
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not np.isfinite(v):
            raise BadInput(f"{where}{label} must be a number.")
        lo, hi = LIMITS[key]
        if not lo <= v <= hi:
            raise BadInput(f"{where}{label} must be between {lo} and {hi}.")
        row.append(float(v))
    return row


def risk_band(p):
    return "Low" if p < 0.30 else "Moderate" if p < 0.60 else "High"


def predict_rows(rows):
    X = pd.DataFrame(rows, columns=[c for _, c in FIELDS])
    probs = model.predict_proba(X)[:, 1]
    return [{"probability": round(float(p), 4), "prediction": int(p >= THRESHOLD),
             "risk": risk_band(p), "threshold": THRESHOLD} for p in probs]


app = Flask(__name__)


@app.errorhandler(BadInput)
def bad_input(e):
    return jsonify(error=str(e)), 400


@app.post("/api/predict")
def predict():
    data = request.get_json(silent=True)
    if data is None:
        raise BadInput("Request body must be JSON.")
    return jsonify(predict_rows([to_row(data)])[0])


@app.post("/api/predict/batch")
def predict_batch():
    data = request.get_json(silent=True)
    records = data.get("records") if isinstance(data, dict) else None
    if not isinstance(records, list) or not records:
        raise BadInput("'records' must be a non-empty list.")
    if len(records) > 10000:
        raise BadInput("At most 10,000 rows per request.")
    rows = [to_row(r, f"Row {i + 2}: ") for i, r in enumerate(records)]
    return jsonify(threshold=THRESHOLD, results=predict_rows(rows))


# Serve only the three front-end files (not the dataset or the model)
@app.get("/")
def index():
    return send_from_directory(BASE, "index.html")


@app.get("/<name>")
def static_files(name):
    if name in {"style.css", "brain.js"}:
        return send_from_directory(BASE, name)
    return "Not found", 404


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
