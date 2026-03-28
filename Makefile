setup:
	chmod +x scripts/setup.sh && ./scripts/setup.sh

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

cert-reset:
	docker compose stop nginx
	docker compose rm -f nginx
	docker volume ls -q | grep cityxai | grep nginx | xargs -r docker volume rm || true
	docker compose up -d nginx

test:
	docker compose config
