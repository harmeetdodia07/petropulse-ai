import os
import requests
import openai
import google.generativeai as genai
from typing import Dict, Any, Optional
from datetime import datetime

class BaseClient:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def _get(self, url: str, params: Optional[Dict] = None) -> Dict:
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching from {url}: {e}")
            return {}

class OilPriceClient(BaseClient):
    """Client for OilPriceAPI.com"""
    def get_latest_prices(self):
        url = "https://api.oilpriceapi.com/v1/prices/latest"
        headers = {"Authorization": f"Token {self.api_key}", "Content-Type": "application/json"}
        try:
            r = requests.get(url, headers=headers, timeout=10)
            return r.json()
        except:
            return {}

class AlphaVantageClient(BaseClient):
    """Client for AlphaVantage.co"""
    def get_brent_price(self):
        url = "https://www.alphavantage.co/query"
        params = {"function": "BRENT", "interval": "daily", "apikey": self.api_key}
        return self._get(url, params)

    def get_usd_inr(self):
        url = "https://www.alphavantage.co/query"
        params = {"function": "CURRENCY_EXCHANGE_RATE", "from_currency": "USD", "to_currency": "INR", "apikey": self.api_key}
        return self._get(url, params)

class EIAClient(BaseClient):
    """Client for EIA.gov"""
    def get_weekly_brent(self):
        # Using the series ID WBRTE found in research
        url = "https://api.eia.gov/v2/petroleum/pri/spt/data/"
        params = {
            "frequency": "weekly",
            "data[0]": "value",
            "facets[series][]": "WBRTE",
            "sort[0][column]": "period",
            "sort[0][direction]": "desc",
            "api_key": self.api_key
        }
        return self._get(url, params)

class FREDClient(BaseClient):
    """Client for Federal Reserve (FRED)"""
    def get_interest_rate(self):
        url = "https://api.stlouisfed.org/fred/series/observations"
        params = {
            "series_id": "DFF", # Federal Funds Effective Rate
            "api_key": self.api_key,
            "file_type": "json",
            "sort_order": "desc",
            "limit": 1
        }
        return self._get(url, params)

class AIService:
    def __init__(self, openai_key: str, gemini_key: str):
        self.openai_client = openai.OpenAI(api_key=openai_key)
        genai.configure(api_key=gemini_key)
        self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')

    def generate_market_insights(self, market_data: Dict[str, Any]) -> str:
        prompt = f"""
        Analyze the following oil market data and provide 3 key business recommendations for oil importers and logistics companies:
        Data: {market_data}
        
        Provide the response in JSON format with fields: 'headline', 'recommendations' (list), and 'risk_bias'.
        """
        try:
            # Primary: OpenAI for structural JSON
            response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI failed, falling back to Gemini: {e}")
            try:
                # Fallback: Gemini
                response = self.gemini_model.generate_content(prompt)
                return response.text
            except Exception as e2:
                print(f"AI Service failed entirely: {e2}")
                return "{}"
