---
title: "Heap 0 - picoCTF (pwn, Easy)"
date: 2026-04-08
description: "picoCTF easy pwn challenge — introduction to heap buffer overflows."
---

## Task

Are overflows just a stack concern? 
Download the binary here. Download the source here.
Additional details will be available after launching your challenge instance.
**Author:** Abrxs, pr1or1tyQ

---
## Initial Recon

First i started the program to get a overview on whats going on:

```
Welcome to heap0!
I put my data on the heap so it should be safe from any tampering.
Since my data isn't on the stack I'll even let you write whatever info you want to the heap, I already took care of using malloc for you.

Heap State:
+-------------+----------------+
[*] Address   ->   Heap Data   
+-------------+----------------+
[*]   0x56e208c8a2b0  ->   pico
+-------------+----------------+
[*]   0x56e208c8a2d0  ->   bico
+-------------+----------------+

1. Print Heap:		(print the current state of the heap)
2. Write to buffer:	(write to your own personal block of data on the heap)
3. Print safe_var:	(I'll even let you look at my variable on the heap, I'm confident it can't be modified)
4. Print Flag:		(Try to print the flag, good luck)
5. Exit

Enter your choice: 

```

The program starts with a menu-based application and shows an initial heap layout containing two allocated heap chunks.

- one containing `"pico"`
- one containing `"bico"`

The program also provides multiple interaction options such as printing the heap, writing to a buffer, and printing the flag

---
## Source Code Analysis


```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define FLAGSIZE_MAX 64
// amount of memory allocated for input_data
#define INPUT_DATA_SIZE 5
// amount of memory allocated for safe_var
#define SAFE_VAR_SIZE 5

int num_allocs;
char *safe_var;
char *input_data;

void check_win() {
    if (strcmp(safe_var, "bico") != 0) {
        printf("\nYOU WIN\n");

        // Print flag
        char buf[FLAGSIZE_MAX];
        FILE *fd = fopen("flag.txt", "r");
        fgets(buf, FLAGSIZE_MAX, fd);
        printf("%s\n", buf);
        fflush(stdout);

        exit(0);
    } else {
        printf("Looks like everything is still secure!\n");
        printf("\nNo flage for you :(\n");
        fflush(stdout);
    }
}

void print_menu() {
    printf("\n1. Print Heap:\t\t(print the current state of the heap)"
           "\n2. Write to buffer:\t(write to your own personal block of data "
           "on the heap)"
           "\n3. Print safe_var:\t(I'll even let you look at my variable on "
           "the heap, "
           "I'm confident it can't be modified)"
           "\n4. Print Flag:\t\t(Try to print the flag, good luck)"
           "\n5. Exit\n\nEnter your choice: ");
    fflush(stdout);
}

void init() {
    printf("\nWelcome to heap0!\n");
    printf(
        "I put my data on the heap so it should be safe from any tampering.\n");
    printf("Since my data isn't on the stack I'll even let you write whatever "
           "info you want to the heap, I already took care of using malloc for "
           "you.\n\n");
    fflush(stdout);
    input_data = malloc(INPUT_DATA_SIZE);
    strncpy(input_data, "pico", INPUT_DATA_SIZE);
    safe_var = malloc(SAFE_VAR_SIZE);
    strncpy(safe_var, "bico", SAFE_VAR_SIZE);
}

void write_buffer() {
    printf("Data for buffer: ");
    fflush(stdout);
    scanf("%s", input_data);
}

void print_heap() {
    printf("Heap State:\n");
    printf("+-------------+----------------+\n");
    printf("[*] Address   ->   Heap Data   \n");
    printf("+-------------+----------------+\n");
    printf("[*]   %p  ->   %s\n", input_data, input_data);
    printf("+-------------+----------------+\n");
    printf("[*]   %p  ->   %s\n", safe_var, safe_var);
    printf("+-------------+----------------+\n");
    fflush(stdout);
}

int main(void) {

    // Setup
    init();
    print_heap();

    int choice;

    while (1) {
        print_menu();
	int rval = scanf("%d", &choice);
	if (rval == EOF){
	    exit(0);
	}
        if (rval != 1) {
            //printf("Invalid input. Please enter a valid choice.\n");
            //fflush(stdout);
            // Clear input buffer
            //while (getchar() != '\n');
            //continue;
	    exit(0);
        }

        switch (choice) {
        case 1:
            // print heap
            print_heap();
            break;
        case 2:
            write_buffer();
            break;
        case 3:
            // print safe_var
            printf("\n\nTake a look at my variable: safe_var = %s\n\n",
                   safe_var);
            fflush(stdout);
            break;
        case 4:
            // Check for win condition
            check_win();
            break;
        case 5:
            // exit
            return 0;
        default:
            printf("Invalid choice\n");
            fflush(stdout);
        }
    }
}


```

After reviewing the source code, the main behavior of the program depends on the variable `safe_var`.
	
The program prints the flag if the following condition is met:

```
if (strcmp(safe_var, "bico") != 0) {
        printf("\nYOU WIN\n");
```
This means that the program considers the user a winner if `safe_var` is changed to anything other than `"bico"`.

---
## Vulnerability Analysis

The key vulnerability is that the user input is read using `scanf(%s)` without any length restriction.

```
void write_buffer() {
    printf("Data for buffer: ");
    fflush(stdout);
    scanf("%s", input_data);
}

```

Although `input_data` is allocated with only 5 bytes:

```
#define INPUT_DATA_SIZE 5
input_data = malloc(INPUT_DATA_SIZE);
```

This allows the user to input more data then the allocated heap buffer can hold, resulting in a heap buffer overflow

Since heap allocations are placed next to each other in memory, overflowing `input_data` can overwrite adjacent heap data, including `safe_var`.

---
## Exploitation

By providing more input than the allocated heap buffer can handle, we are able to trigger a heap buffer overflow.

Since `input_data` and `safe_var` are stored adjacently in the heap, overflowing `input_data` allows us to overwrite the contents of `safe_var`.

By replacing the original value `"bico"` with a different value (e.g. `"AAAAAAAAAA"`), the condition in the `check_win()` function is satisfied:

```
strcmp(safe_var, "bico") != 0
```
As a result, the program detects that `safe_var` has been modified and triggers the win condition, which prints the flag.

`picoCTF{FLAG}`

---
Author: ml0w6c65766c
