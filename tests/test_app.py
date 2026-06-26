import copy
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient

import src.app as app_module


client = TestClient(app_module.app)


@pytest.fixture(autouse=True)
def isolate_activities():
    original = copy.deepcopy(app_module.activities)
    yield
    app_module.activities.clear()
    app_module.activities.update(original)


def test_get_activities():
    response = client.get("/activities")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    assert "Chess Club" in data


def test_signup_success_and_duplicate_blocked():
    activity = "Chess Club"
    email = "newstudent@mergington.edu"
    url = f"/activities/{quote(activity)}/signup"

    response = client.post(url, params={"email": email})
    assert response.status_code == 200
    assert response.json()["message"] == f"Signed up {email} for {activity}"
    assert email in app_module.activities[activity]["participants"]

    response2 = client.post(url, params={"email": email})
    assert response2.status_code == 400
    assert response2.json()["detail"] == "Student already signed up"


def test_remove_participant_success_and_not_found():
    activity = "Chess Club"
    existing_email = app_module.activities[activity]["participants"][0]
    url = f"/activities/{quote(activity)}/participants"

    response = client.delete(url, params={"email": existing_email})
    assert response.status_code == 200
    assert response.json()["message"] == f"Removed {existing_email} from {activity}"
    assert existing_email not in app_module.activities[activity]["participants"]

    response2 = client.delete(url, params={"email": existing_email})
    assert response2.status_code == 404
    assert response2.json()["detail"] == "Participant not found"

    response3 = client.delete(f"/activities/{quote('No Such Activity')}/participants", params={"email": "someone@x.com"})
    assert response3.status_code == 404
    assert response3.json()["detail"] == "Activity not found"


def test_capacity_limit_enforcement():
    activity = "Chess Club"
    app_module.activities[activity]["max_participants"] = len(app_module.activities[activity]["participants"])
    url = f"/activities/{quote(activity)}/signup"

    response = client.post(url, params={"email": "latecomer@mergington.edu"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Activity is full"


def test_create_temporary_activity_and_cleanup():
    temp_name = "Temp Activity"
    app_module.activities[temp_name] = {
        "description": "Temporary test activity",
        "schedule": "Now",
        "max_participants": 5,
        "participants": [],
    }

    response = client.get("/activities")
    assert response.status_code == 200
    assert temp_name in response.json()

    del app_module.activities[temp_name]
    response2 = client.get("/activities")
    assert temp_name not in response2.json()
