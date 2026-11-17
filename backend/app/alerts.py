import os
import logging
from datetime import datetime, timezone
from typing import Optional, Dict
import httpx

logger = logging.getLogger("health_monitor.alerts")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# Discord embed color codes
SEVERITY_COLORS = {
    "CRITICAL": 0xE74C3C,  # Red
    "WARNING": 0xF39C12,   # Amber / Orange
    "RESOLVED": 0x2ECC71,  # Green
    "INFO": 0x3498DB,      # Blue
}


class IncidentStateManager:
    """
    Smart state tracker to avoid alert spamming.
    Tracks active incident states per source and only emits:
    1. Initial alert when an issue starts.
    2. Severity change alert if it escalates (e.g. WARNING -> CRITICAL).
    3. Exactly one RESOLVED alert when the issue clears.
    """

    def __init__(self):
        # Maps source key (e.g., 'System CPU', 'Endpoint: 1') to current severity
        self._active_states: Dict[str, str] = {}

    def check_state(self, source: str, is_degraded: bool, severity: str = "WARNING") -> Optional[str]:
        """
        Determines if an alert should be sent.
        Returns:
            - severity string ("CRITICAL", "WARNING", "RESOLVED") if an alert SHOULD be dispatched.
            - None if no transition occurred (suppresses repeated alerts).
        """
        current_active = self._active_states.get(source)

        if is_degraded:
            if current_active is None:
                # New incident started
                self._active_states[source] = severity
                return severity
            elif current_active != severity:
                # Severity changed (e.g., escalated WARNING -> CRITICAL)
                self._active_states[source] = severity
                return severity
            else:
                # Already alerted and severity unchanged -> suppress spam
                return None
        else:
            if current_active is not None:
                # Issue cleared! Send single RESOLVED notification
                del self._active_states[source]
                return "RESOLVED"
            else:
                # Healthy and was already healthy
                return None

    def is_in_incident(self, source: str) -> bool:
        return source in self._active_states

    def reset(self):
        """Resets all internal states (primarily for testing)."""
        self._active_states.clear()


# Global state manager instance
alert_tracker = IncidentStateManager()


async def send_webhook_alert(
    title: str,
    message: str,
    severity: str = "INFO",
    webhook_url: Optional[str] = None,
) -> bool:
    """
    Sends a formatted alert embed to the configured Discord Webhook URL.
    If DISCORD_WEBHOOK_URL is not set or empty, logs cleanly to console without error.
    """
    normalized_severity = severity.upper()
    url = webhook_url or os.getenv("DISCORD_WEBHOOK_URL", "").strip()

    if not url:
        logger.info(
            "[%s ALERT] %s - %s (Discord webhook URL not configured; logged to console)",
            normalized_severity,
            title,
            message,
        )
        return False

    color = SEVERITY_COLORS.get(normalized_severity, SEVERITY_COLORS["INFO"])
    now_utc = datetime.now(timezone.utc)

    payload = {
        "username": "HealthSentinel Monitor",
        "avatar_url": "https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/grafana.png",
        "embeds": [
            {
                "title": f"[{normalized_severity}] {title}",
                "description": message,
                "color": color,
                "timestamp": now_utc.isoformat(),
                "fields": [
                    {"name": "Severity", "value": normalized_severity, "inline": True},
                    {"name": "Status", "value": "RESOLVED" if normalized_severity == "RESOLVED" else "TRIGGERED", "inline": True},
                    {"name": "Timestamp", "value": now_utc.strftime("%Y-%m-%d %H:%M:%S UTC"), "inline": False},
                ],
                "footer": {
                    "text": "Automated Linux Server & API Health Monitoring System",
                },
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code in (200, 204):
                logger.info("Discord webhook alert sent successfully: %s [%s]", title, normalized_severity)
                return True
            else:
                logger.warning(
                    "Discord webhook returned status %s: %s",
                    response.status_code,
                    response.text,
                )
                return False
    except Exception as e:
        logger.error("Failed to dispatch Discord webhook alert: %s", e)
        return False
