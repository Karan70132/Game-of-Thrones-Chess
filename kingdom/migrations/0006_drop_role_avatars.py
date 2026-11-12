from django.db import migrations

ROLE_AVATARS = ["sentinel", "queen", "oldking", "ranger", "shieldmaiden", "sage", "sellsword", "warden"]


def clear(apps, schema_editor):
    apps.get_model("kingdom", "Profile").objects.filter(avatar__in=ROLE_AVATARS).update(avatar="")


class Migration(migrations.Migration):
    dependencies = [("kingdom", "0005_more_portraits")]
    operations = [migrations.RunPython(clear, migrations.RunPython.noop)]
