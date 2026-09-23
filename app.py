from pathlib import Path

from flask import Flask, jsonify, render_template, request
import pandas as pd
import json
import joblib

app = Flask(__name__)

# Load trained Machine Learning model & Dataset safely
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / 'house_model.pkl'
DATA_PATH = BASE_DIR / 'data' / 'housing_data.json'

model = None
housing_data = []

# Load model if available
if MODEL_PATH.exists():
    model = joblib.load(MODEL_PATH)

# Load JSON dataset if available
if DATA_PATH.exists():
    with DATA_PATH.open(encoding='utf-8') as f:
        housing_data = json.load(f)

@app.route('/')
def home():
    # Serves the index.html page from templates/
    return render_template('index.html')


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'modelLoaded': model is not None})

@app.route('/api/data', methods=['GET'])
def get_data():
    return jsonify(housing_data)

@app.route('/api/recommend', methods=['POST'])
def recommend():
    if model is None:
        return jsonify({'error': 'Model not trained yet. Please run train.py first!'}), 500

    req = request.json or {}
    max_budget = float(req.get('maxBudget', 0))
    min_beds = int(req.get('minBedrooms', 1))
    min_sqft = int(req.get('minSqft', 0))
    min_loc = int(req.get('minLocation', 1))
    selected_area = req.get('selectedArea', 'ALL')

    if not housing_data:
        return jsonify({})

    df = pd.DataFrame(housing_data)

    # Make AI Predictions using scikit-learn model
    X = df[['sqft', 'bedrooms', 'bathrooms', 'locationScore', 'age']]
    df['predictedPrice'] = model.predict(X).round(-2)

    # Filter based on user inputs & budget
    filtered = df[
        (df['predictedPrice'] <= max_budget) &
        (df['bedrooms'] >= min_beds) &
        (df['sqft'] >= min_sqft) &
        (df['locationScore'] >= min_loc)
    ]

    if selected_area != 'ALL':
        filtered = filtered[filtered['area'] == selected_area]

    # Group results area-wise
    grouped_result = {}
    for area, group in filtered.groupby('area'):
        grouped_result[str(area)] = group.to_dict(orient='records')

    return jsonify(grouped_result)

@app.route('/api/predict', methods=['POST'])
def predict_single():
    if model is None:
        return jsonify({'error': 'Model not trained yet. Please run train.py first!'}), 500

    data = request.json or {}
    try:
        input_features = [[
            float(data.get('sqft', 0)),
            int(data.get('bedrooms', 1)),
            int(data.get('bathrooms', 1)),
            int(data.get('locationScore', 1)),
            int(data.get('age', 0))
        ]]
        
        predicted_price = model.predict(input_features)[0]
        return jsonify({'predictedPrice': round(predicted_price, -2)})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=False)