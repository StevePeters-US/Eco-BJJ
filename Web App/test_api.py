import urllib.request
import json
import ssl

def test_list_classes():
    url = "http://localhost:8000/api/list_classes"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=2) as response:
            print(f"List Classes Status: {response.status}")
            print(f"List Classes Body: {response.read().decode('utf-8')}")
    except Exception as e:
        print(f"List Classes Error: {e}")

def test_load_class(name):
    url = "http://localhost:8000/api/load_class"
    data = json.dumps({"name": name}).encode('utf-8')
    try:
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=2) as response:
            print(f"Load Class Status: {response.status}")
            # print(f"Load Class Body: {response.read().decode('utf-8')}") # Might be large
            print("Load Class Body received")
    except Exception as e:
        print(f"Load Class Error: {e}")

if __name__ == "__main__":
    print("Testing List Classes...")
    test_list_classes()
    print("\nTesting Load Class 'Evening Class 02-18-26'...")
    test_load_class("Evening Class 02-18-26")
