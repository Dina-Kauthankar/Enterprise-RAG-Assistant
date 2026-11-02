import json
import os
from typing import List, Dict, Any
from app.db.session import SessionLocal
from app.services.retrieval import search_dense, search_sparse, reciprocal_rank_fusion
from app.services.reranker import rerank_chunks

def load_eval_questions(filepath: str = "eval/questions.json") -> List[Dict[str, Any]]:
    if not os.path.exists(filepath):
        base_dir = os.path.dirname(__file__)
        filepath = os.path.join(base_dir, "questions.json")
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def evaluate_retrieval():
    questions = load_eval_questions()
    db = SessionLocal()

    metrics = {
        "dense_only": {"hits@5": 0, "mrr": 0.0},
        "sparse_only": {"hits@5": 0, "mrr": 0.0},
        "hybrid_rrf": {"hits@5": 0, "mrr": 0.0},
        "hybrid_rerank": {"hits@5": 0, "mrr": 0.0},
    }
    total = len(questions)

    print(f"===========================================================")
    print(f"Running Retrieval Evaluation on {total} Benchmark Questions")
    print(f"===========================================================")

    for item in questions:
        q = item["question"]
        expected_doc = item["expected_doc"]
        expected_page = item["expected_page"]
        role = item.get("allowed_role", "employee")

        # 1. Dense Search
        dense_top = search_dense(q, user_role=role, db=db, limit=20)
        
        # 2. Sparse Search
        sparse_top = search_sparse(q, user_role=role, db=db, limit=20)

        # 3. Hybrid RRF
        hybrid_top = reciprocal_rank_fusion(dense_top, sparse_top, k=60, top_k=20)

        # 4. Hybrid + Reranker
        reranked_top, _ = rerank_chunks(q, hybrid_top, top_k=5)

        pipelines = {
            "dense_only": dense_top[:5],
            "sparse_only": sparse_top[:5],
            "hybrid_rrf": hybrid_top[:5],
            "hybrid_rerank": reranked_top[:5]
        }

        for name, chunks in pipelines.items():
            hit = False
            for rank, c in enumerate(chunks, start=1):
                # Check if expected document and page matched
                if expected_doc.lower() in c.get("doc_title", "").lower() and c.get("page_no") == expected_page:
                    metrics[name]["hits@5"] += 1
                    metrics[name]["mrr"] += 1.0 / rank
                    hit = True
                    break

    db.close()

    print("\n--- Evaluation Results ---")
    print(f"{'Strategy':<20} | {'Hit-Rate@5':<12} | {'MRR':<10}")
    print("-" * 48)
    for name, data in metrics.items():
        hit_rate = (data["hits@5"] / total) * 100 if total > 0 else 0
        mrr = data["mrr"] / total if total > 0 else 0
        print(f"{name:<20} | {hit_rate:>10.1f}% | {mrr:>8.3f}")
    print("===========================================================\n")

if __name__ == "__main__":
    evaluate_retrieval()

