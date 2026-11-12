import os
import secrets
from pathlib import Path
import dj_database_url

BASE_DIR = Path(__file__).resolve().parents[1]
PRODUCTION = os.getenv("ROOKROOM_ENV") == "production"
DEBUG = not PRODUCTION
if PRODUCTION:
    SECRET_KEY = os.environ["SECRET_KEY"]
else:
    keyfile = BASE_DIR / ".local-key"
    if not keyfile.exists():
        try:
            with keyfile.open("x") as f:
                keyfile.chmod(0o600)
                f.write(secrets.token_urlsafe(64))
        except FileExistsError:
            pass
    SECRET_KEY = keyfile.read_text()
ALLOWED_HOSTS = [h for h in ["localhost","127.0.0.1",os.getenv("RENDER_EXTERNAL_HOSTNAME")] if h]
ROOT_URLCONF = "rookroom.urls"
WSGI_APPLICATION = "rookroom.wsgi.application"
INSTALLED_APPS = ["django.contrib.auth","django.contrib.contenttypes","django.contrib.sessions","django.contrib.messages","whitenoise.runserver_nostatic","django.contrib.staticfiles","kingdom"]
MIDDLEWARE = ["django.middleware.security.SecurityMiddleware","whitenoise.middleware.WhiteNoiseMiddleware","django.contrib.sessions.middleware.SessionMiddleware","django.contrib.messages.middleware.MessageMiddleware","django.middleware.csrf.CsrfViewMiddleware","django.contrib.auth.middleware.AuthenticationMiddleware","django.middleware.clickjacking.XFrameOptionsMiddleware"]
TEMPLATES = [{"BACKEND":"django.template.backends.django.DjangoTemplates","DIRS":[BASE_DIR/"templates"],"OPTIONS":{"context_processors":["django.template.context_processors.request","django.contrib.auth.context_processors.auth","django.contrib.messages.context_processors.messages","kingdom.context_processors.player"]}}]
DATABASES = {"default": dj_database_url.parse(os.environ["DATABASE_URL"]) if PRODUCTION else {"ENGINE":"django.db.backends.sqlite3","NAME":BASE_DIR/"local.sqlite3"}}
AUTH_PASSWORD_VALIDATORS = [{"NAME":"django.contrib.auth.password_validation."+v} for v in ("UserAttributeSimilarityValidator","MinimumLengthValidator","CommonPasswordValidator","NumericPasswordValidator")]
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR/"dist"]
STATIC_ROOT = BASE_DIR/"staticfiles"
# Browsers must re-check static files on every load (cheap "not modified" replies). Otherwise they guess
# a cache lifetime and can keep an old engine file after an update, which breaks Robo's search worker.
WHITENOISE_MAX_AGE = 0
LOGIN_URL = "/login/"
LOGIN_REDIRECT_URL = "/play/"
LOGOUT_REDIRECT_URL = "/login/"
SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = SECURE_SSL_REDIRECT = PRODUCTION
if PRODUCTION:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO","https")
