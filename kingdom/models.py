from django.conf import settings
from django.db import models

from .houses import AVATAR_CHOICES, HOUSE_CHOICES, TITLE_CHOICES, HOUSES, avatar_src

MAX_PHOTO_CHARS = 150_000  # a ~110 KB image as a data URL; the browser shrinks uploads first


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    house = models.CharField(max_length=12, choices=HOUSE_CHOICES, default="knight")
    title = models.CharField(max_length=40, choices=TITLE_CHOICES, blank=True, default="")
    avatar = models.CharField(max_length=16, choices=AVATAR_CHOICES, blank=True, default="")
    photo = models.TextField(blank=True, default="")  # data:image/...;base64,... (optional, wins over the avatar)
    wins = models.PositiveIntegerField(default=0)
    losses = models.PositiveIntegerField(default=0)
    draws = models.PositiveIntegerField(default=0)
    updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} ({self.house})"

    @property
    def crest(self):
        return HOUSES.get(self.house, HOUSES["knight"])

    @property
    def picture(self):
        """What the crest shows: an uploaded photo, else the chosen avatar, else nothing (the house piece)."""
        if self.photo:
            return self.photo
        return avatar_src(self.avatar)

    @property
    def games(self):
        return self.wins + self.losses + self.draws

    @property
    def display(self):
        name = self.user.get_username()
        return f"{name} {self.title}" if self.title else name


def profile_for(user):
    profile, _ = Profile.objects.get_or_create(user=user)
    return profile
