.PHONY: install test run build

install:
	python3 -m pip install -r requirements.txt

test:
	python3 -m pytest -q

run:
	python3 -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

build: install test
	python3 -m compileall -q backend tests
