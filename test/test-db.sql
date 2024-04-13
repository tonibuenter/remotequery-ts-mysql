create table test.T_APP_JSON
(
    NAME   text not null,
    JSON   text null,
    ORIGIN text null,
    TAGS   text null
);

create table test.T_APP_PROPERTIES
(
    NAME  text not null,
    VALUE text null
);

create table test.T_USER
(
    NAME     varchar(128) null,
    USER_TID bigint       not null
        primary key,
    EMAIL    varchar(128) null,
    constraint T_USER_EMAIL_uindex
        unique (EMAIL)
);



create table test.COL_NAME
(
    SNAIL_CASE varchar(128) default '',
    camelCase  varchar(128) default '',
    ALLCAPS    varchar(128) default '',
    value4you    varchar(128) default ''
);

