from appium import webdriver
from selenium.webdriver.common.actions import interaction
from selenium.webdriver.common.actions.pointer_input import PointerInput
from selenium.webdriver.common.actions.action_builder import ActionBuilder
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from appium.options.common import AppiumOptions
import time


# --- GESTURE UTILITIES --- #

def take_screenshot(driver, label):
    filename = f"screenshot_{label}_{int(time.time())}.png"
    driver.save_screenshot(filename)
    print(f"[SNAPSHOT] Saved screenshot: {filename}")


def tap(driver, x, y):
    print(f"[STEP] Performing tap at ({x}, {y})...")
    finger = PointerInput(interaction.POINTER_TOUCH, "finger")
    action = ActionBuilder(driver, mouse=finger)
    action.pointer_action.move_to_location(x, y)
    action.pointer_action.pointer_down()
    action.pointer_action.pause(0.2)
    action.pointer_action.pointer_up()
    action.perform()
    print("[DONE] Tap completed!")
    time.sleep(1.0)


def long_press(driver, x, y, duration=0.9):
    print(f"[STEP] Performing long press at ({x}, {y})...")
    finger = PointerInput(interaction.POINTER_TOUCH, "finger")
    action = ActionBuilder(driver, mouse=finger)
    action.pointer_action.move_to_location(x, y)
    action.pointer_action.pointer_down()
    action.pointer_action.pause(duration)
    action.pointer_action.pointer_up()
    action.perform()
    print("[DONE] Long press completed!")
    time.sleep(2.0)


def drag_and_drop(driver, start_x, start_y, end_x, end_y, move_duration=0.5):
    print(f"[STEP] Dragging from ({start_x}, {start_y}) to ({end_x}, {end_y})...")
    finger = PointerInput(interaction.POINTER_TOUCH, "finger")
    action = ActionBuilder(driver, mouse=finger)
    action.pointer_action.move_to_location(start_x, start_y)
    action.pointer_action.pointer_down()
    action.pointer_action.pause(0.1)
    action.pointer_action.move_to_location(end_x, end_y)
    action.pointer_action.pause(move_duration)
    action.pointer_action.pointer_up()
    action.perform()
    print("[DONE] Drag & Drop completed!")
    time.sleep(2.0)


def two_finger_pinch(driver, center_x, center_y, distance_change=300, duration=0.5, direction='out'):
    print(f"[STEP] Performing two-finger gesture ({direction})...")

    # Use the built-in mobile commands for pinch gestures
    if direction == "out":
        # Pinch open (zoom in/grow)
        driver.execute_script('mobile: pinchOpenGesture', {
            'left': center_x - 100,
            'top': center_y - 100,
            'width': 200,
            'height': 200,
            'percent': 0.75,
            'speed': int(duration * 1000)
        })
    else:
        # Pinch close (zoom out/shrink)
        driver.execute_script('mobile: pinchCloseGesture', {
            'left': center_x - 100,
            'top': center_y - 100,
            'width': 200,
            'height': 200,
            'percent': 0.75,
            'speed': int(duration * 1000)
        })
    
    print(f"[DONE] Two-finger gesture ({direction}) completed!")
    time.sleep(2.0)


# --- COORDINATE BRIDGE --- #

def get_ar_object_coords(driver, timeout=15):
    element_id = "ar_coords_textview"
    print(f"[INFO] Waiting for AR object coordinates (timeout={timeout}s)...")

    try:
        WebDriverWait(driver, 5).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, f"#{element_id}"))
        )
        print("[INFO] ✓ Coordinate bridge element found!")
    except TimeoutException:
        print(f"[ERROR] Element '{element_id}' not found in DOM.")
        print("[DEBUG] Available contexts:", driver.contexts)
        print("[DEBUG] Current context:", driver.current_context)
        print("[DEBUG] Page source snippet:")
        print(driver.page_source[:500])
        raise TimeoutException(f"Element '{element_id}' never appeared in DOM.")

    start = time.time()
    while time.time() - start < timeout:
        try:
            text = driver.find_element(By.CSS_SELECTOR, f"#{element_id}").text
            print(f"[DEBUG] Current bridge value: '{text}'")
            if text and text.strip() not in ["-", ""]:
                parts = text.split(",")
                if len(parts) == 2:
                    try:
                        x = int(float(parts[0]))
                        y = int(float(parts[1]))
                        print(f"[INFO] ✓ Received coordinates: ({x}, {y})")
                        return x, y
                    except ValueError:
                        print(f"[WARN] Invalid coordinate: {text}")
            time.sleep(0.5)
        except NoSuchElementException:
            print("[WARN] Element disappeared, waiting...")
            time.sleep(0.5)
    raise TimeoutException(f"Did not receive valid AR coordinates after {timeout}s.")


def switch_to_web_context(driver):
    print("[INFO] Checking available contexts...")
    contexts = driver.contexts
    print(f"[INFO] Available contexts: {contexts}")
    web_context = None
    for context in contexts:
        if "WEBVIEW" in context or "CHROMIUM" in context:
            web_context = context
            break
    if web_context:
        print(f"[INFO] Switching to web context: {web_context}")
        driver.switch_to.context(web_context)
        print(f"[INFO] ✓ Now in context: {driver.current_context}")
        return True
    print("[WARN] No web context found!")
    return False


# --- STEP RUNNER --- #

def run_step(step_name, func, *args, **kwargs):
    ans = input(f"Run {step_name}? (Y/N): ").strip().lower()
    if ans == "y":
        driver = args[0]
        take_screenshot(driver, f"{step_name}_before")
        func(*args, **kwargs)
        time.sleep(2)
        take_screenshot(driver, f"{step_name}_after")
        return True
    else:
        print(f"[SKIPPED] {step_name}")
        return False


# --- MAIN EXECUTION --- #

if __name__ == "__main__":

    print("[INFO] Connecting to already-open chrome/app session...")
    caps = {
        "platformName": "Android",
        "automationName": "UiAutomator2",
        "noReset": True,
        "dontStopAppOnReset": True
    }
    options = AppiumOptions()
    options.load_capabilities(caps)

    driver = None
    try:
        driver = webdriver.Remote("http://127.0.0.1:4723", options=options)
        print("[INFO] ✓ Attached successfully!")

        print("\n" + "="*50)
        if not switch_to_web_context(driver):
            print("[ERROR] Failed to switch to web context.")
            raise Exception("Cannot proceed without web context")
        print("="*50 + "\n")

        time.sleep(2)
        size = driver.get_window_size()
        center_x = size["width"] // 2
        center_y = size["height"] // 2
        print(f"[INFO] Screen size: {size['width']}x{size['height']}")
        print(f"[INFO] Center: ({center_x}, {center_y})")

        # === STEP 1 ===
        print("\n=== STEP 1: Place Object ===")
        if run_step("Tap [Place Object]", tap, driver, center_x, center_y):
            time.sleep(3)

        # === STEP 2 ===
        print("\n=== STEP 2: Get Initial Coordinates ===")
        ar_x, ar_y = get_ar_object_coords(driver, timeout=20)

        # === STEP 3 ===
        print("\n=== STEP 3: Reset Object ===")
        if run_step("LongPress [Reset]", long_press, driver, ar_x, ar_y):
            ar_x, ar_y = get_ar_object_coords(driver, timeout=10)

        # === STEP 4 ===
        print("\n=== STEP 4: Move Object ===")
        target_x = int(size["width"] * 0.8)
        target_y = int(size["height"] * 0.2)
        if run_step("DragDrop [Move Object]", drag_and_drop,
                    driver, ar_x, ar_y, target_x, target_y):
            ar_x, ar_y = get_ar_object_coords(driver, timeout=10)

        # === STEP 5 ===
        print("\n=== STEP 5: Grow Object ===")
        if run_step("PinchOut [Grow]", two_finger_pinch,
                    driver, ar_x, ar_y, distance_change=250, direction="out"):
            ar_x, ar_y = get_ar_object_coords(driver, timeout=10)

        # === STEP 6 ===
        print("\n=== STEP 6: Shrink Object ===")
        run_step("PinchIn [Shrink]", two_finger_pinch,
                 driver, ar_x, ar_y, distance_change=250, direction="in")

        print("\n[SUCCESS] ✓ All tests completed!")

    except Exception as e:
        print(f"\n[FATAL ERROR] {e}")
        import traceback
        traceback.print_exc()

    finally:
        if driver:
            print("\n[INFO] Ending Appium session...")
            driver.quit()
            print("[INFO] Session ended!")
