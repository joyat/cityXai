up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

seed:
	chmod +x scripts/seed-demo-data.sh scripts/ollama-init.sh && ./scripts/seed-demo-data.sh

reset:
	docker compose down -v
	rm -rf data/audit/* data/failed/* data/incoming/* data/processed/*

test:
	docker compose config
