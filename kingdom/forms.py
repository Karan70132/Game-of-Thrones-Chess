import re

from django import forms
from django.contrib.auth.forms import UserCreationForm

from .houses import AVATAR_CHOICES, HOUSE_CHOICES, TITLE_CHOICES
from .models import MAX_PHOTO_CHARS, Profile

PHOTO_RE = re.compile(r"^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$")


class SignupForm(UserCreationForm):
    house = forms.ChoiceField(choices=HOUSE_CHOICES, initial="knight", widget=forms.RadioSelect)
    avatar = forms.ChoiceField(choices=AVATAR_CHOICES, required=False, widget=forms.RadioSelect)


class ProfileForm(forms.ModelForm):
    house = forms.ChoiceField(choices=HOUSE_CHOICES, widget=forms.RadioSelect)
    title = forms.ChoiceField(choices=TITLE_CHOICES, required=False)
    avatar = forms.ChoiceField(choices=AVATAR_CHOICES, required=False, widget=forms.RadioSelect)
    photo = forms.CharField(required=False, widget=forms.HiddenInput)

    class Meta:
        model = Profile
        fields = ["house", "title", "avatar", "photo"]

    def clean_photo(self):
        photo = (self.cleaned_data.get("photo") or "").strip()
        if not photo:
            return ""
        if len(photo) > MAX_PHOTO_CHARS or not PHOTO_RE.match(photo):
            raise forms.ValidationError("Use a PNG, JPEG or WebP picture. Large pictures are shrunk automatically; try a smaller one if this persists.")
        return photo
