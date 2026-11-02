from typing import List, Dict, Any, Tuple
from app.core.config import settings

_reranker_model = None

def get_reranker_model():
    global _reranker_model
    if _reranker_model is None:
        from sentence_transformers import CrossEncoder
        _reranker_model = CrossEncoder(settings.RERANKER_MODEL_NAME)
    return _reranker_model

def rerank_chunks(query: str, candidates: List[Dict[str, Any]], top_k: int = 5) -> Tuple[List[Dict[str, Any]], float]:
    """
    Reranks candidate chunks with Cross-Encoder.
    Returns:
      (top_k_chunks, best_score)
    """
    if not candidates:
        return [], float("-inf")

    model = get_reranker_model()
    sentence_pairs = [[query, c["text"]] for c in candidates]
    
    scores = model.predict(sentence_pairs)

    for i, c in enumerate(candidates):
        c["rerank_score"] = float(scores[i])

    sorted_candidates = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)
    best_score = sorted_candidates[0]["rerank_score"] if sorted_candidates else float("-inf")

    return sorted_candidates[:top_k], best_score

