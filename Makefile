.PHONY: install test run build docker-build docker-run deploy-prod deploy-prod-logs deploy-prod-down

install:
	python3 -m pip install -r requirements.txt

test:
	python3 -m pytest -q

run:
	python3 -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

build: install test
	python3 -m compileall -q backend tests

docker-build:
	docker build -t leadership-risk-intelligence:latest .

docker-run:
	docker run --rm -p 8000:8000 \
		-e LSI_API_PASSWORD=$${LSI_API_PASSWORD:-change-me} \
		-e LSI_JWT_SECRET=$${LSI_JWT_SECRET:-dev-secret-change} \
		-e LSI_TOKEN_TTL_MINUTES=$${LSI_TOKEN_TTL_MINUTES:-480} \
		leadership-risk-intelligence:latest

deploy-prod:
	docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

deploy-prod-logs:
	docker compose --env-file .env.production -f docker-compose.prod.yml logs -f

deploy-prod-down:
	docker compose --env-file .env.production -f docker-compose.prod.yml down
