import watchdog
import watchdog.observers
import watchdog.events
import shutil
import subprocess
import pathlib
import re
import http.server
import os
class Watcher:
    def dispatch(self, event):
        try:
            # Called with every event
            if (not isinstance(event, watchdog.events.FileMovedEvent) or not "p5js_canvas" in (path := pathlib.Path(event.dest_path)).name
                    or path.name.endswith(".part") or path.name.endswith("crdownload")):
                return

            match = re.match(r"p5js_canvas(_([a-zA-Z0-9]*))?.*?\.([a-z]+)", path.name)
            if match is None:
                print("Non-matching filename:", path.name)
                return
            _, seed, file_extension = match.groups()
            
            all_commit_messages = subprocess.check_output(["git", "log", "--format=%h %B", "HEAD"]).decode().strip().split("\n\n")
            commit_message_matches = (match for commit_message in all_commit_messages if (
                match := re.match("([0123456789abcdef]*?) (.*? iteration) (\\d+)", commit_message)) is not None)
            if (match := next(commit_message_matches, None)):
                previous_commit_hash, description, previous_iteration = match.groups()
                iteration = int(previous_iteration) + 1
            else:
                previous_commit_hash = None
                description = "p5.js project, iteration"
                iteration = 1
            new_commit_message = f"{description} {iteration}"
            commit_hash = None
            if subprocess.call(["git", "commit", "-a", "-m", new_commit_message]) != 0:
                iteration -= 1 # We're still at the previous iteration, no new commit created
                commit_hash = previous_commit_hash
            if commit_hash is None:
                commit_hash = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"]).decode().strip()
            output_image_index = 1
            while (output_sample_path := pathlib.Path(f"outputs/p5js_canvas-{commit_hash}-{(seed + '-') if len(seed) > 0 else ''}{output_image_index}.{file_extension}")).exists():
                output_image_index += 1
            os.makedirs("outputs", exist_ok=True)
            shutil.move(path, output_sample_path)
            subprocess.check_call(["git", "add", output_sample_path])
            subprocess.check_call(["git", "commit", "-m", f"example {output_image_index} (iteration {iteration}, {commit_hash})"])
        except Exception as e:
            print("Error occurred:")
            print(e)


def main():
    observer = watchdog.observers.Observer()
    observer.schedule(Watcher(), "/home/vuenc/Downloads", recursive=False)
    observer.start()
    try:
        subprocess.check_call(["python", "-m", "http.server", "--bind", "0.0.0.0"])
    finally:
        observer.join()

if __name__ == "__main__":
    main()
