from django.test import Client, TestCase
from django.conf import settings
from pathlib import Path

from kingdom.models import Profile


class AccountsAndArchive(TestCase):
    def test_public_scroll_experience(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Game of Thrones')
        for marker in ['id="stage"', 'id="versus"', 'id="saga"', 'Baelor', 'id="court"', 'id="puzzle"', 'id="banner"', 'id="enter"', '/static/js/home.js', 'houses-data']:
            self.assertContains(response, marker)
        self.assertContains(self.client.get('/login/'), 'name="password"')
        signup = self.client.get('/signup/')
        self.assertContains(signup, 'name="password2"')
        self.assertContains(signup, 'name="house"')

    def test_account_round_trip(self):
        client = Client(enforce_csrf_checks=True)
        self.assertRedirects(client.get("/play/"), "/login/?next=/play/", fetch_redirect_response=False)
        self.assertEqual(client.get("/api/model/").status_code, 302)
        client.get("/signup/")
        credentials = {"username": "rooktester", "password1": "test-only-X8mv5Vo1", "password2": "test-only-X8mv5Vo1", "house": "rook"}
        self.assertEqual(client.post("/signup/", credentials).status_code, 403)

        def post(url, data):
            return client.post(url, {**data, "csrfmiddlewaretoken": client.cookies["csrftoken"].value})
        self.assertEqual(post("/signup/", {**credentials, "avatar": "sam"}).status_code, 302)
        self.assertEqual(Profile.objects.get(user__username="rooktester").house, "rook")
        self.assertEqual(Profile.objects.get(user__username="rooktester").avatar, "sam")
        play = client.get("/play/")
        self.assertContains(play, 'id="scene"')
        self.assertContains(play, 'id="flat-host"')
        self.assertContains(play, "House Greyjoy")
        self.assertIn("model", client.get("/api/model/").json())
        self.assertEqual(post("/logout/", {}).status_code, 302)
        self.assertEqual(client.get("/api/model/").status_code, 302)
        self.assertEqual(post("/login/", {"username": credentials["username"], "password": credentials["password1"]}).status_code, 302)
        self.assertContains(client.get("/play/"), "rooktester")

    def test_signup_house_from_quiz(self):
        response = self.client.get('/signup/?house=bishop')
        self.assertContains(response, 'value="bishop" checked')

    def test_results_and_profile(self):
        client = Client(enforce_csrf_checks=True)
        client.get("/signup/")
        token = lambda: client.cookies["csrftoken"].value
        client.post("/signup/", {"username": "banner", "password1": "test-only-Q2w9Lp0z", "password2": "test-only-Q2w9Lp0z", "house": "knight", "csrfmiddlewaretoken": token()})
        api = lambda result: client.post("/api/result/", data=f'{{"result": "{result}"}}', content_type="application/json", HTTP_X_CSRFTOKEN=token())
        self.assertEqual(api("win").json(), {"wins": 1, "losses": 0, "draws": 0})
        api("loss"); api("draw")
        self.assertEqual(api("loss").json(), {"wins": 1, "losses": 2, "draws": 1})
        self.assertEqual(api("cheat").status_code, 400)
        self.assertEqual(client.get("/profile/").status_code, 200)
        saved = client.post("/profile/", {"house": "queen", "title": "Hand of the King", "photo": "", "csrfmiddlewaretoken": token()})
        self.assertEqual(saved.status_code, 302)
        player = Profile.objects.get(user__username="banner")
        self.assertEqual((player.house, player.title), ("queen", "Hand of the King"))
        client.post("/profile/", {"house": "queen", "title": "", "avatar": "arya", "photo": "", "csrfmiddlewaretoken": token()})
        self.assertEqual(Profile.objects.get(user__username="banner").avatar, "arya")
        self.assertContains(client.get("/play/"), "/static/img/avatars/arya.webp")
        client.post("/profile/", {"house": "queen", "title": "", "avatar": "jon", "photo": "", "csrfmiddlewaretoken": token()})
        self.assertContains(client.get("/play/"), "/static/img/avatars/jon.webp")
        self.assertEqual(client.post("/profile/", {"house": "queen", "avatar": "not-a-face", "csrfmiddlewaretoken": token()}).status_code, 200)
        bad = client.post("/profile/", {"house": "queen", "title": "", "photo": "javascript:alert(1)", "csrfmiddlewaretoken": token()})
        self.assertEqual(bad.status_code, 200)
        self.assertContains(bad, "Use a PNG, JPEG or WebP picture")
        good_photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        client.post("/profile/", {"house": "queen", "title": "", "photo": good_photo, "csrfmiddlewaretoken": token()})
        self.assertEqual(Profile.objects.get(user__username="banner").photo, good_photo)
        self.assertContains(client.get("/play/"), good_photo[:40])

    def test_original(self):
        for source in Path(settings.BASE_DIR / "original").glob("*"):
            response = self.client.get("/original/", {"file": source.name})
            self.assertEqual(response.context["source"], source.read_text())
        self.assertEqual(self.client.get("/original/", {"file": "../manage.py"}).status_code, 404)
