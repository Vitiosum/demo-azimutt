# Two layouts for the Azimutt project

The free plan allows 2 layouts per project and 10 tables per layout. A layout is a saved view:
which tables are on the canvas and which of their columns are shown (hide the others from the table menu).

## Layout 1: "The printed label"

What a visitor reads on the herbarium sheet.

| Show | Columns |
|---|---|
| yes | `id`, `latin_name`, `common_name`, `family`, `locality`, `collected_on`, `collector` |
| hidden | everything else |

Talking point: a business view of the table, without the storage plumbing.

## Layout 2: "Behind the sheet"

Where the image lives and how the row was made.

| Show | Columns |
|---|---|
| yes | `id`, `object_key`, `content_type`, `byte_size`, `drawing`, `seed_key`, `created_sql`, `created_at` |
| hidden | the label columns |

With `herbarium.aml` added as a source, put `cellar.objects` on this layout too: the `object_key -- key` link shows
the boundary between the MySQL add-on and the Cellar add-on.
