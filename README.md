Source code for the [Bomb Party Buddy](https://addons.mozilla.org/firefox/addon/bomb-party-buddy/) firefox extension.
## Hi, this project added some new features in the code including the menu and its features, but I left the readme, liscence, and about everything else the same. Props to NiTrO_FuN for creating the original extension and allowing me to make my forked version.
## Wordlist Utilities

The `words/utils.py` script provides utilities for working with the wordlists in the `words/` directory.  
You can use it to process or manipulate the wordlists before submitting changes.

### Usage

Run the script from the words/ directory:

```sh
python utils.py --help
```

## Adding new words to a wordlist

To add new words to a wordlist, follow these steps:

1. Create a new file containing your words (one per line) and place it in the `words/` directory.
2. Run the following command from the `words/` directory, replacing `FILENAME` with your filename and `LANGUAGE` with the appropriate language code:
    ```sh
    python utils.py --combine FILENAME LANGUAGE
    ```
    This will merge your words into the main wordlist for that language.

    ### Example
    
    Suppose you want to add new English words. Your `words/` directory might look like this:

    ```
    words/
    ├── en.txt
    ├── es.txt
    ├── fr.txt
    └── new-words.txt
    ```

    To add the new words into the English wordlist, run:

    ```sh
    python utils.py --combine new-words.txt en
    ```
3. **Submit your changes:** Create a pull request with your updated wordlist file(s).
