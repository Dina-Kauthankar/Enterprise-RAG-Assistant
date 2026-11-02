import pytest
from app.core.security import get_password_hash, verify_password, create_access_token, decode_access_token
from app.services.ingestion import clean_text, chunk_page_text
from app.services.retrieval import reciprocal_rank_fusion
from app.services.llm import build_prompt

def test_password_hashing():
    pwd = "secretpassword123"
    hashed = get_password_hash(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_jwt_token_flow():
    user_id = "123e4567-e89b-12d3-a456-426614174000"
    role = "admin"
    token = create_access_token(subject=user_id, role=role)
    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("sub") == user_id
    assert payload.get("role") == role

def test_clean_text():
    dirty = "Line 1   with   extra  spaces\r\n\n\nLine 2\fLine 3"
    cleaned = clean_text(dirty)
    assert "Line 1 with extra spaces" in cleaned
    assert "\n\nLine 2" in cleaned

def test_chunking_logic():
    text = "Paragraph 1.\n\nParagraph 2.\n\nParagraph 3."
    chunks = chunk_page_text(text, max_chars=30, overlap_chars=10)
    assert len(chunks) > 1
    # Check that text is preserved across chunks
    combined = " ".join(chunks)
    assert "Paragraph 1" in combined
    assert "Paragraph 2" in combined

def test_rrf_logic():
    dense = [
        {"id": "doc1", "title": "Doc 1"},
        {"id": "doc2", "title": "Doc 2"},
    ]
    sparse = [
        {"id": "doc2", "title": "Doc 2"},
        {"id": "doc3", "title": "Doc 3"},
    ]
    # doc2 appears in both, so it should rank first after RRF
    fused = reciprocal_rank_fusion(dense, sparse, k=60, top_k=3)
    assert len(fused) == 3
    assert fused[0]["id"] == "doc2"
    assert fused[0]["rrf_score"] > fused[1]["rrf_score"]

def test_build_prompt():
    chunks = [
        {"doc_title": "Handbook", "page_no": 5, "text": "Employees get 20 vacation days."}
    ]
    prompt = build_prompt("How many vacation days?", chunks)
    assert "Handbook, p. 5" in prompt
    assert "Employees get 20 vacation days." in prompt
    assert "QUESTION:\nHow many vacation days?" in prompt

