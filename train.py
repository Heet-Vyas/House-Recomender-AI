import json
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import joblib

# 1. Load data from JSON
with open('data/housing_data.json', 'r') as f:
    raw_data = json.load(f)

df = pd.DataFrame(raw_data)

# 2. Features (X) and Target (y)
X = df[['sqft', 'bedrooms', 'bathrooms', 'locationScore', 'age']]
y = df['actualPrice']

# 3. Train Machine Learning Model
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X, y)

# 4. Save trained Python model
joblib.dump(model, 'house_model.pkl')
print("✅ Python ML Model trained successfully and saved to house_model.pkl!")