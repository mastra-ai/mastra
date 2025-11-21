.PHONY: help phoenix-up phoenix-down phoenix-restart phoenix-logs

help:
	@echo "Available commands:"
	@echo "  make phoenix-up       - Start Arize Phoenix"
	@echo "  make phoenix-down     - Stop Arize Phoenix"
	@echo "  make phoenix-restart  - Restart Arize Phoenix"
	@echo "  make phoenix-logs     - View Arize Phoenix logs"

phoenix-up:
	docker-compose up -d

phoenix-down:
	docker-compose down

phoenix-restart:
	docker-compose restart

phoenix-logs:
	docker-compose logs -f phoenix
