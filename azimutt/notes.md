# Notes for the Azimutt project

Azimutt notes are Markdown, attached to a table or a column (click the table or column, then the note icon).
The free plan keeps 10 notes per project: here are 7, ready to paste. The project is not saved on the free plan,
so paste them again at the start of each demo, or use `herbarium.aml`, which carries the same text.

## Table `specimens`

> One pressed specimen per row: the printed label, and where its image lives in Cellar.
> Written by the Herbarium app (FastAPI, `demo-python-mysql-cellar`), 12 seed rows, read here with SELECT only.

## Column `specimens.id`

> Accession number, printed as **Nº 00007** on the sheet. `AUTO_INCREMENT`: the next one is in the table statistics.

## Column `specimens.family`

> Botanical family: the folder tabs of the cabinet. Indexed (`ix_specimens_family`) because the cabinet filters on it.

## Column `specimens.collected_on`

> Shown herbarium style on the label (`14.V.1887`). The seed data spans 1886 to 1894.

## Column `specimens.object_key`

> Key of the image in the **Cellar** bucket. There is no foreign key: MySQL cannot point outside itself.
> Add `herbarium.aml` as a source to draw the link to `cellar.objects`.

## Column `specimens.seed_key`

> Set on seed rows only. Its unique index makes the seed idempotent: restarting the app never duplicates a specimen.

## Column `specimens.created_sql`

> The exact `INSERT` that created the row, as MySQL received it. The Herbarium shows it on each sheet.
