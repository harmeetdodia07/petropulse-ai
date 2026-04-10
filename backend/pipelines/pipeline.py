"""
pipelines/pipeline.py
======================
Convenience wrapper — runs train_all then predict_all in one call.
Intended for scheduling (e.g. daily cron retraining).
"""
import sys
sys.path.insert(0, __file__.replace("/pipelines/pipeline.py", ""))

def run_pipeline(retrain: bool = False, **predict_kwargs):
    if retrain:
        from train_all import train_all
        train_all()
    from predict_all import run_full_prediction
    return run_full_prediction(**predict_kwargs)

if __name__ == "__main__":
    import json
    from utils.serialiser import NumpyEncoder
    result = run_pipeline(retrain=False)
    print(json.dumps(result, indent=2, cls=NumpyEncoder))
