"""
Compatibility entrypoint for running the standalone generation engine.

Example:
python pipeline.py --prompt "a fat cat" --output example.png
"""

from engine import main


if __name__ == "__main__":
    main()
