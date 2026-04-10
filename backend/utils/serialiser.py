"""JSON-safe serialisation helpers."""
import json
import numpy as np


class NumpyEncoder(json.JSONEncoder):
    """Handle numpy types in JSON output."""
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return round(float(obj), 4)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def to_json(data: dict) -> str:
    return json.dumps(data, cls=NumpyEncoder, indent=2)
