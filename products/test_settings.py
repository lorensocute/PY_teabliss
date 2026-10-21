"""Run isolated tests: python manage.py test products --settings=products.test_settings.

Only an in-memory SQLite database is used; no MySQL data is changed.
"""
from config.settings import *  # noqa: F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
